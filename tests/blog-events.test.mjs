import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/blog-events.js", import.meta.url), "utf8");

function load(pathname) {
  const handlers = {};
  const win = { location: { pathname, hostname: "www.grow2guide.com" }, dataLayer: [] };
  const doc = { addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); } };
  new Function("window", "document", src)(win, doc);
  return { win, handlers };
}

// A fake <a>: `inside` lists the selectors its ancestors match.
function link(pathname, text, inside = [], hostname = "www.grow2guide.com") {
  const a = {
    pathname, hostname, textContent: text,
    closest(sel) { return sel === "a[href]" ? a : inside.includes(sel) ? {} : null; },
  };
  return a;
}
const click = (env, a) => env.handlers.click.forEach((fn) => fn({ target: a }));

test("pageSlug reads post slugs and falls back to blog-index", () => {
  const { win } = load("/blog/");
  assert.equal(win.g2gBlogEvents.pageSlug("/blog/late-to-work-nobody-said-a-word/"), "late-to-work-nobody-said-a-word");
  assert.equal(win.g2gBlogEvents.pageSlug("/blog/"), "blog-index");
  assert.equal(win.g2gBlogEvents.pageSlug("/guides/"), "blog-index");
});

test("inline guide link inside the article is an inline CTA click", () => {
  const env = load("/blog/late-to-work-nobody-said-a-word/");
  click(env, link("/guides/", "If you supervise people", ["article"]));
  assert.deepEqual(env.win.dataLayer, [{
    event: "blog_cta_click", post_slug: "late-to-work-nobody-said-a-word",
    cta_placement: "inline", cta_destination: "guides", link_text: "If you supervise people",
  }]);
});

test("guide button in the closing aside is an end CTA click", () => {
  const env = load("/blog/late-to-work-nobody-said-a-word/");
  click(env, link("/guides/", "See both guides — $99", ["aside"]));
  assert.equal(env.win.dataLayer[0].cta_placement, "end");
});

test("consultation links count as CTA clicks too", () => {
  const env = load("/blog/i-didnt-know-wont-protect-you/");
  click(env, link("/consultation/", "Request consultation", []));
  assert.equal(env.win.dataLayer[0].cta_destination, "consultation");
  assert.equal(env.win.dataLayer[0].cta_placement, "other");
});

test("Keep reading links are related clicks", () => {
  const env = load("/blog/late-to-work-nobody-said-a-word/");
  click(env, link("/blog/i-didnt-know-wont-protect-you/", "Nobody explained", ['[aria-labelledby="keep-reading-title"]', "article"]));
  assert.deepEqual(env.win.dataLayer, [{
    event: "blog_related_click", post_slug: "late-to-work-nobody-said-a-word",
    destination_slug: "i-didnt-know-wont-protect-you",
  }]);
});

test("index cards are card clicks; other links push nothing", () => {
  const env = load("/blog/");
  click(env, link("/blog/late-to-work-nobody-said-a-word/", "card", ["main"]));
  assert.deepEqual(env.win.dataLayer, [{ event: "blog_card_click", destination_slug: "late-to-work-nobody-said-a-word" }]);
  click(env, link("/privacy/", "Privacy", ["main"]));
  click(env, link("/guides/", "external", [], "example.com"));
  assert.equal(env.win.dataLayer.length, 1);
});

test("a successful signup pushes newsletter_signup with the right placement", () => {
  const env = load("/blog/the-2-am-replay-after-a-hard-shift/");
  const form = (inPage) => ({ matches: (s) => s === "[data-g2g-subscribe]", closest: (s) => (s === "#subscribe" && inPage ? {} : null) });
  env.handlers.submit.forEach((fn) => fn({ target: form(true) }));
  env.handlers["g2g:subscribed"].forEach((fn) => fn());
  env.handlers.submit.forEach((fn) => fn({ target: form(false) }));
  env.handlers["g2g:subscribed"].forEach((fn) => fn());
  assert.deepEqual(env.win.dataLayer.map((d) => d.signup_placement), ["page", "modal"]);
  assert.equal(env.win.dataLayer[0].event, "newsletter_signup");
  assert.equal(env.win.dataLayer[0].post_slug, "the-2-am-replay-after-a-hard-shift");
});
