import assert from "node:assert/strict";
import { test } from "node:test";
import { PermanentChainError, RetryableError } from "@predictor-foundation/chain-errors";
import type { ChainDefinition, PolkadotSigner } from "polkadot-api";
import { Chain, ChainBase, type SignableTx } from "../src/index.ts";

// read() and submitSigned() take the operation as a parameter, so the whole orchestration (timeout,
// classification, dispatch-failure handling) is exercised with injected fakes and no network. The
// descriptors/signer are only used by methods that touch the client, which these tests never call.
const DESCRIPTORS = {} as unknown as ChainDefinition;
const SIGNER = {} as unknown as PolkadotSigner;

// ChainBase carries the descriptor-less plumbing; Chain<D> extends it. Exercise the plumbing on
// ChainBase directly (no descriptors needed - the untyped-consumer path), and cover Chain<D>'s extras
// separately.
function base() {
	return new ChainBase({ endpoint: "ws://unused", readTimeoutMs: 30, submitTimeoutMs: 30 });
}

test("read resolves a fast op", async () => {
	assert.equal(await base().read(Promise.resolve(42), "read"), 42);
});

test("read classifies a transient rejection as RetryableError", async () => {
	await assert.rejects(
		() => base().read(Promise.reject(new Error("ECONNREFUSED")), "read"),
		(e) => e instanceof RetryableError,
	);
});

test("read leaves an unknown rejection permanent (not RetryableError)", async () => {
	await assert.rejects(
		() => base().read(Promise.reject(new Error("bad signature")), "read"),
		(e) => e instanceof Error && !(e instanceof RetryableError),
	);
});

test("read times out a hung op with a RetryableError", async () => {
	await assert.rejects(
		() => base().read(new Promise<never>(() => {}), "read"),
		(e) => e instanceof RetryableError,
	);
});

test("submitSigned brands a TxSuccess (with extrinsicIndex) on a finalized ok dispatch", async () => {
	const tx: SignableTx = {
		signAndSubmit: async () => ({
			txHash: "0xabc",
			ok: true,
			block: { hash: "0xblk", number: 7, index: 3 },
		}),
	};
	const res = await base().submitSigned(tx, SIGNER, "submit");
	assert.equal(res.txHash, "0xabc");
	assert.equal(res.blockHash, "0xblk");
	assert.equal(res.blockNumber, 7);
	assert.equal(res.extrinsicIndex, 3);
});

test("submitSigned throws PermanentChainError on a finalized-but-failed dispatch", async () => {
	const tx: SignableTx = {
		signAndSubmit: async () => ({
			txHash: "0xabc",
			ok: false,
			dispatchError: { type: "Module", value: { index: 3n } },
			block: { hash: "0xblk", number: 7, index: 2 },
		}),
	};
	await assert.rejects(
		() => base().submitSigned(tx, SIGNER, "submit"),
		(e) => e instanceof PermanentChainError,
	);
});

test("submitSigned classifies a transient submit failure as RetryableError", async () => {
	const tx: SignableTx = {
		signAndSubmit: async () => {
			throw new Error("websocket disconnected");
		},
	};
	await assert.rejects(
		() => base().submitSigned(tx, SIGNER, "submit"),
		(e) => e instanceof RetryableError,
	);
});

test("disconnect is idempotent before any client is created (ChainBase and Chain)", () => {
	const b = base();
	const c = new Chain(DESCRIPTORS, { endpoint: "ws://unused" });
	assert.doesNotThrow(() => {
		b.disconnect();
		b.disconnect();
		c.disconnect();
		c.disconnect();
	});
});

test("Chain<D> extends ChainBase, so it inherits the submit/read plumbing", async () => {
	const c = new Chain(DESCRIPTORS, { endpoint: "ws://unused", submitTimeoutMs: 30 });
	assert.ok(c instanceof ChainBase);
	const tx: SignableTx = {
		signAndSubmit: async () => ({
			txHash: "0xdef",
			ok: true,
			block: { hash: "0xblk2", number: 9, index: 0 },
		}),
	};
	const res = await c.submitSigned(tx, SIGNER, "submit");
	assert.equal(res.extrinsicIndex, 0);
});

// --- smoldot transport (toggle) ---
// The live smoldot path spawns a worker and syncs from the p2p network, so - like the WS path above -
// it is not exercised in unit CI (these tests never call client()). What's covered here is the toggle
// itself: the discriminated `{ smoldot }` option constructs a valid ChainBase, the transport-agnostic
// orchestration is unchanged, status() has nothing to report, and teardown is safe before connecting.
function smoldotBase() {
	return new ChainBase({
		smoldot: { chainSpec: "{}" },
		readTimeoutMs: 30,
		submitTimeoutMs: 30,
	});
}

test("smoldot transport: read orchestration is transport-agnostic", async () => {
	assert.equal(await smoldotBase().read(Promise.resolve(7), "read"), 7);
});

test("smoldot transport: a hung read still times out with a RetryableError", async () => {
	await assert.rejects(
		() => smoldotBase().read(new Promise<never>(() => {}), "read"),
		(e) => e instanceof RetryableError,
	);
});

test("smoldot transport: status() is undefined (no WS status transitions)", () => {
	assert.equal(smoldotBase().status(), undefined);
});

test("disconnect() before connecting is safe (no worker spawned) for both transports", () => {
	base().disconnect();
	smoldotBase().disconnect();
	// idempotent - a second call must not throw either
	smoldotBase().disconnect();
});
