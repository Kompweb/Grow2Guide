import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/self-assessment.js", import.meta.url), "utf8");
const mod = { exports: {} };
new Function("module", "document", src)(mod, undefined);
const { QUESTIONS, CATEGORIES, computeResults, toPercent, bandFor, compareText } = mod.exports;

const answerAll = (fn) => Object.fromEntries(QUESTIONS.map((q) => [q.id, fn(q)]));

test("32 questions in 8 categories of 4, split 16/16 across the two dimensions", () => {
  assert.equal(QUESTIONS.length, 32);
  assert.equal(CATEGORIES.length, 8);
  CATEGORIES.forEach((c) => assert.equal(c.questionIds.length, 4));
  assert.equal(QUESTIONS.filter((q) => q.dimension === "care").length, 16);
  assert.deepEqual(QUESTIONS.map((q) => q.id).slice(0, 2), ["q1", "q2"]);
});

test("toPercent maps the minimum to 0 and the maximum to 100", () => {
  assert.equal(toPercent(4, 4), 0);
  assert.equal(toPercent(20, 4), 100);
  assert.equal(toPercent(16, 16), 0);
  assert.equal(toPercent(80, 16), 100);
  assert.equal(toPercent(12, 4), 50);
});

test("bands switch at 80, 60 and 40", () => {
  assert.equal(bandFor(100).key, "frequent");
  assert.equal(bandFor(80).key, "frequent");
  assert.equal(bandFor(79).key, "generally");
  assert.equal(bandFor(60).key, "generally");
  assert.equal(bandFor(59).key, "inconsistent");
  assert.equal(bandFor(40).key, "inconsistent");
  assert.equal(bandFor(39).key, "priority");
  assert.equal(bandFor(0).key, "priority");
});

test("missing or out-of-range answers are reported by question number", () => {
  const answers = answerAll(() => 3);
  delete answers.q5;
  answers.q32 = 6;
  assert.deepEqual(computeResults(answers), { complete: false, unanswered: [5, 32] });
});

test("all Always scores 100% everywhere, all Never scores 0%", () => {
  const high = computeResults(answerAll(() => 5));
  assert.equal(high.dimensions.care.pct, 100);
  assert.equal(high.dimensions.workplace.pct, 100);
  high.categories.forEach((c) => assert.equal(c.pct, 100));
  const low = computeResults(answerAll(() => 1));
  assert.equal(low.dimensions.care.pct, 0);
  assert.equal(low.dimensions.care.band.key, "priority");
});

test("care and workplace are scored separately and compared", () => {
  const res = computeResults(answerAll((q) => (q.dimension === "care" ? 5 : 2)));
  assert.equal(res.dimensions.care.pct, 100);
  assert.equal(res.dimensions.workplace.pct, 25);
  assert.match(compareText(res)[0], /Care Competence \(100%\) is higher than your Workplace Competence \(25%\)/);
});

test("role picks the next-step guides; skipping shows both", () => {
  const { guidesForRole } = mod.exports;
  assert.deepEqual(guidesForRole("direct-care"), ["guide", "bundle"]);
  assert.deepEqual(guidesForRole("student"), ["guide", "bundle"]);
  assert.deepEqual(guidesForRole("supervisor"), ["supervisor", "bundle"]);
  assert.deepEqual(guidesForRole("skip"), ["guide", "supervisor", "bundle"]);
  assert.deepEqual(guidesForRole(undefined), ["guide", "supervisor", "bundle"]);
});
