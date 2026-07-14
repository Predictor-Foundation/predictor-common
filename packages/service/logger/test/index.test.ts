import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createLogger, DEFAULT_REDACT_KEYS } from "../src/index.ts";

// Capture what the logger writes to stdout/stderr without touching the real streams.
let out: string[];
let err: string[];
const realOut = process.stdout.write.bind(process.stdout);
const realErr = process.stderr.write.bind(process.stderr);

beforeEach(() => {
	out = [];
	err = [];
	process.stdout.write = ((s: string) => {
		out.push(String(s));
		return true;
	}) as typeof process.stdout.write;
	process.stderr.write = ((s: string) => {
		err.push(String(s));
		return true;
	}) as typeof process.stderr.write;
});
afterEach(() => {
	process.stdout.write = realOut;
	process.stderr.write = realErr;
});

const parse = (lines: string[]) => JSON.parse(lines[lines.length - 1]);

test("info/debug go to stdout, warn/error to stderr", () => {
	const log = createLogger({ level: "debug", env: {} });
	log.info("hi");
	log.error("boom");
	assert.equal(parse(out).msg, "hi");
	assert.equal(parse(err).msg, "boom");
});

test("level threshold filters lower levels", () => {
	const log = createLogger({ level: "warn", env: {} });
	log.info("skipped");
	log.warn("kept");
	assert.equal(out.length, 0);
	assert.equal(parse(err).level, "warn");
});

test("base fields and child bindings are merged", () => {
	const log = createLogger({ level: "info", base: { svc: "hb" }, env: {} }).child({ node: "n1" });
	log.info("tick", { count: 3 });
	assert.deepEqual(parse(out), { level: "info", msg: "tick", svc: "hb", node: "n1", count: 3 });
});

test("redacts secret-named fields (case-insensitive, recursive, in arrays)", () => {
	const log = createLogger({ level: "info", env: {} });
	log.info("register", {
		Suri: "//Alice",
		nested: { mnemonic: "one two three", ok: 1 },
		signers: [{ seed: "0xdead", address: "prd1..." }],
	});
	const line = parse(out);
	assert.equal(line.Suri, "[redacted]");
	assert.equal(line.nested.mnemonic, "[redacted]");
	assert.equal(line.nested.ok, 1);
	assert.equal(line.signers[0].seed, "[redacted]");
	assert.equal(line.signers[0].address, "prd1...");
});

test("redacts compound secret names by word boundary (camelCase, snake_case, kebab-case)", () => {
	const log = createLogger({ level: "info", env: {} });
	log.info("compounds", {
		accessToken: "a",
		refreshToken: "b",
		authToken: "c",
		clientSecret: "d",
		dbPassword: "e",
		apiKey: "f",
		authorization: "g",
		privateKey: "h",
		secret_key: "i",
		"auth-token": "j",
	});
	const line = parse(out);
	for (const k of [
		"accessToken",
		"refreshToken",
		"authToken",
		"clientSecret",
		"dbPassword",
		"apiKey",
		"authorization",
		"privateKey",
		"secret_key",
		"auth-token",
	]) {
		assert.equal(line[k], "[redacted]", `${k} should be redacted`);
	}
});

test("keeps non-secret fields whose names merely resemble secret ones", () => {
	const log = createLogger({ level: "info", env: {} });
	log.info("safe", {
		publicKey: "pk",
		signingKey: "sk",
		txHash: "0xabc",
		blockHash: "0xdef",
		blockNumber: 7,
		address: "prd1...",
		nodeId: "n1",
		count: 3,
	});
	const line = parse(out);
	assert.equal(line.publicKey, "pk");
	assert.equal(line.signingKey, "sk");
	assert.equal(line.txHash, "0xabc");
	assert.equal(line.blockHash, "0xdef");
	assert.equal(line.blockNumber, 7);
	assert.equal(line.address, "prd1...");
	assert.equal(line.nodeId, "n1");
	assert.equal(line.count, 3);
});

test("keeps non-secret fields even when they are 0x-hex (tx hashes, addresses)", () => {
	const log = createLogger({ level: "info", env: {} });
	const txHash = `0x${"ab".repeat(32)}`;
	log.info("submitted", { txHash, blockNumber: 42 });
	const line = parse(out);
	assert.equal(line.txHash, txHash);
	assert.equal(line.blockNumber, 42);
});

test("redactKeys: [] disables redaction; custom keys override the default", () => {
	const off = createLogger({ level: "info", env: {}, redactKeys: [] });
	off.info("x", { suri: "//Alice" });
	assert.equal(parse(out).suri, "//Alice");

	const custom = createLogger({ level: "info", env: {}, redactKeys: ["walletId"] });
	custom.info("y", { walletId: "w1", suri: "//Alice" });
	const line = parse(out);
	assert.equal(line.walletId, "[redacted]");
	assert.equal(line.suri, "//Alice"); // not in the custom set
});

test("child keeps the parent's redaction policy", () => {
	const log = createLogger({ level: "info", env: {}, redactKeys: ["seed"] }).child({ svc: "s" });
	log.info("z", { seed: "0xdead", suri: "//Alice" });
	const line = parse(out);
	assert.equal(line.seed, "[redacted]");
	assert.equal(line.suri, "//Alice");
});

test("non-plain values (Date, class instance) keep their serialization, not turned into {}", () => {
	const log = createLogger({ level: "info", env: {} });
	const when = new Date("2026-01-02T03:04:05.000Z");
	class Point {
		x: number;
		y: number;
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
		}
		toJSON() {
			return { x: this.x, y: this.y };
		}
	}
	log.info("event", { when, at: new Point(1, 2) });
	// The written line is JSON text, so compare against how JSON.stringify would render them.
	const raw = out[out.length - 1];
	assert.match(raw, /"when":"2026-01-02T03:04:05.000Z"/);
	assert.match(raw, /"at":\{"x":1,"y":2\}/);
});

test("a reference cycle is rendered safely instead of overflowing the stack", () => {
	const log = createLogger({ level: "info", env: {} });
	const cyclic: Record<string, unknown> = { name: "n" };
	cyclic.self = cyclic;
	log.info("cycle", { cyclic });
	const line = parse(out);
	assert.equal(line.cyclic.name, "n");
	assert.equal(line.cyclic.self, "[circular]");
});

test("a value aliased under two sibling keys (diamond) serializes fully, not [circular]", () => {
	const log = createLogger({ level: "info", env: {} });
	const shared = { id: 7 };
	log.info("diamond", { req: shared, res: shared });
	const line = parse(out);
	assert.deepEqual(line.req, { id: 7 });
	assert.deepEqual(line.res, { id: 7 }); // not "[circular]" - it's aliased, not cyclic
});

test("DEFAULT_REDACT_KEYS covers the obvious secret material", () => {
	for (const k of ["suri", "seed", "mnemonic", "privateKey", "password"]) {
		assert.ok(DEFAULT_REDACT_KEYS.includes(k.toLowerCase()), `${k} should be a default redact key`);
	}
});
