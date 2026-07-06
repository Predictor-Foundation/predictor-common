import assert from "node:assert/strict";
import { test } from "node:test";
import {
	backoffDelayMs,
	classifyChainError,
	maxBackoffDelayMs,
	PermanentChainError,
	RetryableError,
	type RetryPolicy,
	withRetry,
	withTimeout,
} from "../src/index.ts";

test("transient messages classify as retryable", () => {
	for (const msg of [
		"socket disconnected",
		"request timeout",
		"ECONNREFUSED",
		"connection lost",
		"websocket closed",
		"service unavailable",
		"chain not ready",
		"EAI_AGAIN dns",
	]) {
		assert.ok(classifyChainError(new Error(msg)) instanceof RetryableError, `${msg} -> retryable`);
	}
});

test("unknown errors default to permanent (no retry storm)", () => {
	assert.ok(!(classifyChainError(new Error("invalid signature")) instanceof RetryableError));
});

test("already-classified errors pass through untouched", () => {
	const retry = new RetryableError("x");
	const perm = new PermanentChainError("y");
	assert.equal(classifyChainError(retry), retry);
	assert.equal(classifyChainError(perm), perm);
});

test("non-Error throwns are wrapped", () => {
	const c = classifyChainError("plain string");
	assert.ok(c instanceof Error);
	assert.equal(c.message, "plain string");
});

test("withTimeout rejects with a RetryableError when the op hangs", async () => {
	await assert.rejects(
		() => withTimeout(new Promise(() => {}), 20, "hang"),
		(e) => e instanceof RetryableError,
	);
});

test("withTimeout resolves a fast op", async () => {
	assert.equal(await withTimeout(Promise.resolve(42), 1000, "fast"), 42);
});

test("backoff is exponential; maxBackoff is the pre-final sleep", () => {
	const policy: RetryPolicy = { maxRetries: 4, baseDelayMs: 10 };
	assert.equal(backoffDelayMs(policy, 0), 10);
	assert.equal(backoffDelayMs(policy, 2), 40);
	assert.equal(maxBackoffDelayMs(policy), backoffDelayMs(policy, 2)); // attempt maxRetries-2
});

test("withRetry retries RetryableError then succeeds, firing hooks", async () => {
	const policy: RetryPolicy = { maxRetries: 5, baseDelayMs: 1 };
	let attempts = 0;
	let retries = 0;
	const result = await withRetry(
		async () => {
			attempts++;
			if (attempts < 3) throw new RetryableError("transient");
			return "ok";
		},
		policy,
		{ onAttempt: () => {}, onRetry: () => retries++ },
	);
	assert.equal(result, "ok");
	assert.equal(attempts, 3);
	assert.equal(retries, 2);
});

test("withRetry rethrows a permanent error immediately", async () => {
	const policy: RetryPolicy = { maxRetries: 5, baseDelayMs: 1 };
	let attempts = 0;
	await assert.rejects(
		() =>
			withRetry(async () => {
				attempts++;
				throw new PermanentChainError("fatal");
			}, policy),
		(e) => e instanceof PermanentChainError,
	);
	assert.equal(attempts, 1);
});
