import assert from "node:assert/strict";
import { test } from "node:test";
import { compactBn, u64 } from "@polkadot-api/substrate-bindings";
import { compact, fromHex, scaleBytes, toHex, u64le, utf8 } from "../src/index.ts";

// Pin the hand-rolled SCALE helpers byte-for-byte against @polkadot-api/substrate-bindings, the
// same reference codec Substrate's encoding derives from.

test("compact matches the reference codec across size classes", () => {
	for (const v of [0n, 1n, 63n, 64n, 16383n, 16384n, 1n << 30n, 1n << 40n]) {
		assert.deepEqual(compact(v), compactBn.enc(v), `compact(${v})`);
	}
});

test("u64le matches the reference u64 encoder", () => {
	for (const v of [0n, 1n, 255n, 256n, 1_000_000n, 2n ** 63n]) {
		assert.deepEqual(u64le(v), u64.enc(v), `u64le(${v})`);
	}
});

test("scaleBytes prefixes a compact length", () => {
	const payload = utf8("NodeManager_heartbeat");
	assert.deepEqual(scaleBytes(payload), new Uint8Array([...compact(payload.length), ...payload]));
});

test("toHex / fromHex round-trip", () => {
	const bytes = new Uint8Array([0, 1, 15, 16, 255, 128]);
	assert.equal(toHex(bytes), "0x00010f10ff80");
	assert.deepEqual(fromHex(toHex(bytes)), bytes);
});

test("compact rejects negative input", () => {
	assert.throws(() => compact(-1n), RangeError);
});

test("fromHex rejects odd-length input", () => {
	assert.throws(() => fromHex("0xabc"));
});
