import assert from "node:assert/strict";
import { test } from "node:test";
import { u64 } from "@polkadot-api/substrate-bindings";
import { scaleBytes, utf8 } from "@predictor-foundation/scale";
import { HEARTBEAT_CONTEXT, heartbeatSigningPayload } from "../src/index.ts";

test('HEARTBEAT_CONTEXT is the pallet\'s b"NodeManager_heartbeat"', () => {
	assert.deepEqual(HEARTBEAT_CONTEXT, utf8("NodeManager_heartbeat"));
});

test("heartbeat payload is context ++ u64(count) ++ u64(period), count before period", () => {
	const count = 3n;
	const period = 7n;
	const expected = new Uint8Array([
		...scaleBytes(utf8("NodeManager_heartbeat")),
		...u64.enc(count),
		...u64.enc(period),
	]);
	assert.deepEqual(heartbeatSigningPayload({ count, period }), expected);
});

test("count and period are not interchangeable in the payload", () => {
	const a = heartbeatSigningPayload({ count: 3n, period: 7n });
	const b = heartbeatSigningPayload({ count: 7n, period: 3n });
	assert.notDeepEqual(a, b);
});
