import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/subscribe.js", import.meta.url), "utf8");

// A stand-in for a [data-g2g-substack] box holding one iframe.
function fakeBox(placement) {
  const attrs = placement === undefined ? {} : { "data-placement": placement };
  const frame = { tagName: "IFRAME" };
  return {
    frame,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = v; },
    contains: (el) => el === frame,
  };
}

function load(boxes = [], extra = {}) {
  const listeners = {};
  const win = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    setTimeout: (fn) => fn(),
    ...extra,
  };
  const doc = { querySelectorAll: () => boxes, activeElement: null };
  new Function("window", "document", src)(win, doc);
  return { win, doc, listeners };
}

test("placement comes from data-placement and defaults to page", () => {
  const { win } = load();
  assert.equal(win.g2gSubscribe.placementOf(fakeBox("modal")), "modal");
  assert.equal(win.g2gSubscribe.placementOf(fakeBox()), "page");
});

test("each event is pushed once per box, with its placement", () => {
  const { win } = load();
  const box = fakeBox("self_assessment");
  assert.equal(win.g2gSubscribe.push("newsletter_form_start", box), true);
  assert.equal(win.g2gSubscribe.push("newsletter_form_start", box), false);
  win.g2gSubscribe.push("newsletter_form_view", box);
  assert.deepEqual(win.dataLayer, [
    { event: "newsletter_form_start", signup_placement: "self_assessment" },
    { event: "newsletter_form_view", signup_placement: "self_assessment" },
  ]);
});

test("clicking into a Substack form pushes newsletter_form_start for that box only", () => {
  const page = fakeBox("page");
  const modal = fakeBox("modal");
  const { win, doc, listeners } = load([page, modal]);
  doc.activeElement = { tagName: "INPUT" };
  listeners.blur();
  assert.equal(win.dataLayer, undefined);
  doc.activeElement = modal.frame;
  listeners.blur();
  listeners.blur();
  assert.deepEqual(win.dataLayer, [{ event: "newsletter_form_start", signup_placement: "modal" }]);
});

test("a box at least half on screen pushes newsletter_form_view once", () => {
  const box = fakeBox("page");
  let callback;
  class IO {
    constructor(fn, opts) { callback = fn; assert.equal(opts.threshold, 0.5); }
    observe() {}
    unobserve() {}
  }
  const { win } = load([box], { IntersectionObserver: IO });
  callback([{ isIntersecting: false, target: box }]);
  assert.equal(win.dataLayer, undefined);
  callback([{ isIntersecting: true, target: box }]);
  callback([{ isIntersecting: true, target: box }]);
  assert.deepEqual(win.dataLayer, [{ event: "newsletter_form_view", signup_placement: "page" }]);
});

test("pages without a Substack form register nothing", () => {
  const { listeners } = load([]);
  assert.deepEqual(Object.keys(listeners), []);
});
