import assert from "node:assert/strict";
import { test } from "node:test";
import { asPlanck, assertSs58, parseSs58 } from "../src/index.ts";

// Well-known //Alice on the generic substrate prefix (42).
const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

test("parseSs58 accepts a valid address and brands it", () => {
	assert.equal(parseSs58(ALICE), ALICE);
});

test("parseSs58 trims surrounding whitespace", () => {
	assert.equal(parseSs58(`  ${ALICE}  `), ALICE);
});

test("parseSs58 rejects garbage and empty input", () => {
	assert.equal(parseSs58("not-an-address"), null);
	assert.equal(parseSs58(""), null);
});

test("assertSs58 returns the branded address for valid input", () => {
	assert.equal(assertSs58(ALICE), ALICE);
});

test("assertSs58 throws on invalid input", () => {
	assert.throws(() => assertSs58("nope"), TypeError);
});

test("asPlanck brands a non-negative bigint", () => {
	assert.equal(asPlanck(0n), 0n);
	assert.equal(asPlanck(1_000_000_000_000n), 1_000_000_000_000n);
});

test("asPlanck rejects a negative amount", () => {
	assert.throws(() => asPlanck(-1n), RangeError);
});
