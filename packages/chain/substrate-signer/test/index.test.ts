import assert from "node:assert/strict";
import { test } from "node:test";
import { DEV_PHRASE, sr25519 } from "@polkadot-labs/hdkd-helpers";
import { AccountUtils, deriveDev, deriveKeypair, parseSuri } from "../src/index.ts";

// Well-known //Alice on the generic substrate prefix (42).
const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

test("deriveDev derives the well-known //Alice address", () => {
	assert.equal(deriveDev("//Alice").address, ALICE);
});

test("deriveKeypair treats an empty phrase (bare //Alice) as the dev mnemonic", () => {
	assert.equal(deriveKeypair("//Alice").address, ALICE);
});

test("deriveKeypair exposes a PAPI signer and a raw sign", () => {
	const kp = deriveKeypair("//Alice");
	assert.equal(kp.publicKey.length, 32);
	assert.equal(typeof kp.signer.signBytes, "function");
	const sig = kp.sign(new Uint8Array([1, 2, 3]));
	assert.equal(sig.length, 64); // sr25519 signature
});

// The seed-wipe safety argument (see withSeed) hinges on the sign closure never aliasing the
// mini-secret for a *junction-less* SURI, the one path where hdkd does no derivation and would
// otherwise return the seed itself. deriveKeypair wipes the seed before returning, so a signature
// that still verifies here proves the closure holds a distinct buffer, not the zeroed seed.
for (const [label, secret] of [
	["raw 0x mini-secret", `0x${"11".repeat(32)}`],
	["bare dev mnemonic (no junction)", DEV_PHRASE],
] as const) {
	test(`deriveKeypair(${label}) still signs and verifies after the seed wipe`, () => {
		const kp = deriveKeypair(secret);
		assert.equal(parseSuri(secret).path, ""); // junction-less: the aliasing-risk path
		const message = new Uint8Array([4, 5, 6, 7]);
		const sig = kp.sign(message);
		assert.equal(sig.length, 64); // sr25519 signature
		assert.equal(sr25519.verify(sig, message, kp.publicKey), true);
	});
}

test("parseSuri accepts a 0x mini-secret seed", () => {
	const seed = `0x${"11".repeat(32)}`;
	const suri = parseSuri(seed);
	assert.equal(suri.miniSecret.length, 32);
	assert.equal(suri.path, "");
});

test("parseSuri rejects the ///password form (would silently mis-derive)", () => {
	assert.throws(() => parseSuri("//Alice///password"), /password-form/);
});

test("AccountUtils round-trips address <-> public key", () => {
	const pk = AccountUtils.addressToPublicKey(ALICE);
	assert.match(pk, /^0x[0-9a-f]{64}$/);
	assert.equal(AccountUtils.publicKeyToAddress(pk), ALICE);
});

test("AccountUtils.convertToPublicKeyIfNeeded is idempotent on a public key", () => {
	const pk = AccountUtils.addressToPublicKey(ALICE);
	assert.equal(AccountUtils.convertToPublicKeyIfNeeded(pk), pk);
	assert.equal(AccountUtils.convertToPublicKeyIfNeeded(ALICE), pk);
});

test("AccountUtils.convertToAddress normalises a public key back to its address", () => {
	const pk = AccountUtils.addressToPublicKey(ALICE);
	assert.equal(AccountUtils.convertToAddress(pk), ALICE);
	assert.equal(AccountUtils.convertToAddress(ALICE), ALICE);
});

test("isAccountPK distinguishes hex keys from ss58 addresses", () => {
	assert.equal(AccountUtils.isAccountPK(`0x${"ab".repeat(32)}`), true);
	assert.equal(AccountUtils.isAccountPK(ALICE), false);
});

test("addressFromSuri matches the address the signer derives (shared parseSuri)", () => {
	assert.equal(AccountUtils.addressFromSuri("//Alice"), deriveDev("//Alice").address);
});

test("generateNewAccount mints a fresh, seed-recoverable account with no mnemonic", () => {
	const acc = AccountUtils.generateNewAccount();
	assert.equal(acc.mnemonic, null);
	assert.match(acc.seed, /^0x[0-9a-f]{64}$/);
	assert.match(acc.publicKey, /^0x[0-9a-f]{64}$/);
	assert.equal(AccountUtils.addressToPublicKey(acc.address), acc.publicKey);
});
