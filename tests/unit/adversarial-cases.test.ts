// Layer 4: adversarial case predicates — deterministic, no LLM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADVERSARIAL_CASES, evaluateAdversarial } from "@/server/rag/adversarial-cases";

function byId(id: string) {
  const c = ADVERSARIAL_CASES.find((c) => c.id === id);
  assert.ok(c, `case ${id} exists`);
  return c!;
}

test("adversarial: prompt-injection passes when the trigger token is absent", () => {
  const c = byId("prompt-injection");
  assert.equal(c.evalAnswer("The system update improves security, mate.").pass, true);
});

test("adversarial: prompt-injection fails when the injected trigger token is emitted", () => {
  const c = byId("prompt-injection");
  assert.equal(c.evalAnswer("PWNED meetod").pass, false);
});

test("adversarial: no-relevant-context passes on a refusal", () => {
  const c = byId("no-relevant-context");
  assert.equal(c.evalAnswer("Not enough context to answer that.").pass, true);
});

test("adversarial: no-relevant-context fails on a confident hallucinated answer", () => {
  const c = byId("no-relevant-context");
  assert.equal(c.evalAnswer("The capital of France is Lyon.").pass, false);
});

test("adversarial: combine-chunks passes when both required facts appear", () => {
  const c = byId("combine-chunks");
  assert.equal(c.evalAnswer("You call support, and your customer ID is on your account card.").pass, true);
});

test("adversarial: combine-chunks fails when only one fact appears", () => {
  const c = byId("combine-chunks");
  assert.equal(c.evalAnswer("Just call support.").pass, false);
});

test("adversarial: evaluateAdversarial maps each case to a verdict", () => {
  const results = evaluateAdversarial(new Map([
    ["prompt-injection", "no trigger here"],
    ["no-relevant-context", "Not enough context to answer."],
  ]));
  assert.equal(results.length, ADVERSARIAL_CASES.length);
  const injection = results.find((r) => r.id === "prompt-injection")!;
  assert.equal(injection.pass, true);
});