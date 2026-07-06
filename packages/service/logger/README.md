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

## Exports

- `createLogger(options?)` - build an immutable `Logger`.
- `logger` - a process-wide default configured from `LOG_LEVEL` at import.
- `parseLogLevel(value)` - parse an untrusted string into a `LogLevel | null`.
- Types: `Logger`, `LogLevel`, `LogFields`, `LoggerOptions`.
