# @predictor-foundation/chain-errors

The chain-boundary error taxonomy and retry helpers shared by the Predictor Foundation PAPI
services. **No runtime dependencies** - logging is injected via callbacks.

Every failure that escapes a chain boundary is classified into exactly one of two shapes, so callers
branch on `instanceof RetryableError` and nothing else:

- **`RetryableError`** - transient (socket drop, timeout, RPC unavailable). Retrying may help.
- **`PermanentChainError`** - a deliberate fail-fast (invalid tx, bad signature, a finalized-but-failed
  dispatch). Retrying cannot help.

`classifyChainError` defaults the *unknown* to permanent, so a misconfigured node can never trigger a
retry storm.

## API

| Export | Description |
|---|---|
| `RetryableError`, `PermanentChainError` | The two error shapes (both accept `{ cause }`). |
| `classifyChainError(err)` | Classify any thrown value: already-classified passes through; transient message → `RetryableError`; else returned as-is (permanent). |
| `sleep(ms)` | Promise-based delay. |
| `withTimeout(op, ms, label)` | Reject with `RetryableError` if `op` does not settle in time. |
| `RetryPolicy` | `{ maxRetries, baseDelayMs }`. |
| `backoffDelayMs(policy, attempt)` / `maxBackoffDelayMs(policy)` | The exponential backoff curve. |
| `withRetry(op, policy, hooks?)` | Retry while `op` throws `RetryableError`; `hooks.onAttempt`/`onRetry` observe progress. |

```ts
import { withRetry, classifyChainError, type RetryPolicy } from "@predictor-foundation/chain-errors";

const policy: RetryPolicy = { maxRetries: 4, baseDelayMs: 250 };
await withRetry(() => submit(), policy, {
  onRetry: ({ attempt, delayMs, error }) => log.warn("retrying", { attempt, delayMs, error: error.message }),
});
```

## Scripts

```bash
pnpm build        # tsc -> lib/
pnpm test         # unit tests (needs Node >= 22.6)
pnpm types:check  # tsc --noEmit
```
