// Error taxonomy + retry for the chain boundary of a PAPI service.
//
// Every failure that escapes the boundary is classified into exactly one of two shapes so callers
// branch on `instanceof RetryableError` and nothing else:
//   - RetryableError    - transient (socket drop, timeout, RPC unavailable). Retrying may help.
//   - PermanentChainError - a deliberate fail-fast (invalid tx, bad signature, a finalized-but-failed
//     dispatch, a decode mismatch). Retrying cannot help; surface it.
// The classifier defaults the UNKNOWN to permanent, so a misconfigured node can never trigger a
// retry storm. This package has no runtime dependencies (logging is injected via callbacks).

/** A transient failure worth retrying (connection drop, timeout, RPC unavailable). */
export class RetryableError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "RetryableError";
	}
}

/** A deliberate, non-retryable failure. The classifier must never re-interpret this as transient. */
export class PermanentChainError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "PermanentChainError";
	}
}

/**
 * Substrings that mark a raw error as a transient transport problem. The union of the patterns the
 * PAPI backends grew independently - matching more here only ever moves an error from permanent to
 * retryable, which is the safe direction for a transport failure.
 */
const TRANSIENT_PATTERNS: readonly RegExp[] = [
	/disconnect/i,
	/timeout/i,
	/timed?\s*out/i,
	/connection/i,
	/not connected/i,
	/socket/i,
	/network/i,
	/websocket/i,
	/unavailable/i,
	/not\s*ready/i,
	/ECONNREFUSED/i,
	/ECONNRESET/i,
	/ETIMEDOUT/i,
	/EAI_AGAIN/i,
];

/**
 * Turn any thrown value into a classified error. Already-classified errors pass through untouched
 * (so a stringified dispatch error that happens to contain "connection" can never be re-read as
 * transient). Raw errors whose message matches a transient pattern become {@link RetryableError};
 * everything else is returned as-is (permanent by default).
 */
export function classifyChainError(err: unknown): Error {
	if (err instanceof RetryableError || err instanceof PermanentChainError) return err;
	const message = err instanceof Error ? err.message : String(err);
	if (TRANSIENT_PATTERNS.some((re) => re.test(message))) {
		return new RetryableError(message, { cause: err });
	}
	return err instanceof Error ? err : new Error(message);
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reject with a {@link RetryableError} if `op` does not settle within `ms`, so a hung socket (a WS
 * RPC that stops responding without closing) cannot stall a call indefinitely. A timeout is
 * transient by nature, hence retryable.
 */
export function withTimeout<T>(op: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new RetryableError(`${label} timed out after ${ms}ms`)),
			ms,
		);
		op.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

/** Backoff policy for {@link withRetry}. An object, so the two numbers cannot be swapped. */
export interface RetryPolicy {
	readonly maxRetries: number;
	readonly baseDelayMs: number;
}

/** Delay before attempt `n` (0-based): exponential in the attempt number. */
export function backoffDelayMs(policy: RetryPolicy, attempt: number): number {
	return policy.baseDelayMs * 2 ** attempt;
}

/**
 * The longest single sleep {@link withRetry} can take under `policy` - the backoff before the final
 * attempt. Exported so liveness-window sizing derives from the same curve instead of re-deriving the
 * backoff shape at a distance.
 */
export function maxBackoffDelayMs(policy: RetryPolicy): number {
	return policy.maxRetries >= 2 ? backoffDelayMs(policy, policy.maxRetries - 2) : 0;
}

/** Optional callbacks so a caller can observe attempts without this package depending on a logger. */
export interface RetryHooks {
	/**
	 * Fires at the start of every attempt, so a caller can advance a liveness marker: a legitimately
	 * slow attempt (a submit awaiting finalization) must not read as a wedged loop just because it
	 * outlasts a single tick interval.
	 */
	readonly onAttempt?: () => void;
	/** Fires before each backoff sleep, so a caller can log the retry. */
	readonly onRetry?: (info: { attempt: number; delayMs: number; error: Error }) => void;
}

/**
 * Retry `op` with exponential backoff, but only while it throws {@link RetryableError}; a
 * {@link PermanentChainError} (or any other error) is rethrown immediately.
 */
export async function withRetry<T>(
	op: () => Promise<T>,
	policy: RetryPolicy,
	hooks?: RetryHooks,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < policy.maxRetries; attempt++) {
		hooks?.onAttempt?.();
		try {
			return await op();
		} catch (error) {
			lastError = error;
			if (!(error instanceof RetryableError)) throw error;
			// Don't sleep after the final attempt - there is no retry after it.
			if (attempt === policy.maxRetries - 1) break;
			const delayMs = backoffDelayMs(policy, attempt);
			hooks?.onRetry?.({ attempt: attempt + 1, delayMs, error });
			await sleep(delayMs);
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
