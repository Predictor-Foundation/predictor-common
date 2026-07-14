# @predictor-foundation/logger

Tiny, dependency-free structured logger for Predictor Foundation services. Emits
one JSON object per line, splits `warn`/`error` to stderr and `debug`/`info` to
stdout, and filters by a minimum level.

Use it in plain-Node processes (schedulers, workers, CLIs) that run outside an
HTTP framework and so have no request logger of their own. HTTP services that
already have a framework logger (e.g. Fastify's pino) should keep using it; this
package only defines the shared `Logger` contract they can also satisfy.

## Usage

```ts
import { createLogger } from "@predictor-foundation/logger";

const logger = createLogger({ level: "info", base: { service: "heartbeat" } });

logger.info("started", { port: 8080 });
// {"level":"info","msg":"started","service":"heartbeat","port":8080}

const nodeLog = logger.child({ nodeId: "abc" });
nodeLog.warn("retrying", { attempt: 2 });
// {"level":"warn","msg":"retrying","service":"heartbeat","nodeId":"abc","attempt":2}
```

When `level` is omitted it is resolved from `LOG_LEVEL`, then defaults to
`info`. An unrecognised `LOG_LEVEL` falls back to `info` rather than throwing.

## Redaction

Secret-named fields are replaced with `[redacted]` before a line is written, at
any depth of the fields object:

```ts
logger.info("signing", { suri: "//Alice", accessToken: "abc" });
// {"level":"info","msg":"signing","suri":"[redacted]","accessToken":"[redacted]"}
```

- **Matched by word boundary, not exact equality.** A field is redacted if its
  full lower-cased name is in the set, or any of its camelCase / snake_case /
  kebab-case words is - so `token` catches `accessToken`, `refresh_token`, and
  `auth-token` alike. This biases toward over-redaction (e.g. `tokenCount`),
  which is the safe default for a security feature.
- **Matched by key, not by value shape.** A secret seed and an on-chain tx hash
  are both `0x`+64 hex, so value-pattern redaction would destroy the very
  hashes/addresses you want in logs. Keep secrets in named fields, never
  interpolated into `msg`.
- **Structured values pass through intact.** Only arrays and plain records are
  traversed; a `Date`, `Map`/`Set`, `Error`, typed array, or class instance is
  left untouched so its serialization is preserved. Accidental reference cycles
  render as `[circular]`.

Defaults are in `DEFAULT_REDACT_KEYS` (suri, secret, seed, mnemonic, password,
token, credential(s), authorization, plus joined compounds like `apikey` and
`privatekey`). Override with the `redactKeys` option; pass `[]` to disable.
Child loggers inherit the parent's redaction policy.

## Exports

- `createLogger(options?)` - build an immutable `Logger`.
- `logger` - a process-wide default configured from `LOG_LEVEL` at import.
- `parseLogLevel(value)` - parse an untrusted string into a `LogLevel | null`.
- `DEFAULT_REDACT_KEYS` - the field-name words redacted by default.
- Types: `Logger`, `LogLevel`, `LogFields`, `LoggerOptions`.
