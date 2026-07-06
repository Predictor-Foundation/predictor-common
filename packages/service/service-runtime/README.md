# @predictor-foundation/service-runtime

Building blocks for long-lived Node services (schedulers, workers, daemons):
a health state machine, k8s-correct probe routes, a self-guarding tick loop, and
graceful shutdown. Extracted from the near-identical wiring in
`heartbeat-service` and `faucet`.

Each piece is independent - take only what you need. `fastify` is a peer
dependency, used only by `registerHealthRoutes`; non-HTTP workers can use the
scheduler, health monitor, and shutdown helper without it.

## Usage

```ts
import Fastify from "fastify";
import {
	HealthMonitor,
	registerHealthRoutes,
	createTickLoop,
	installGracefulShutdown,
} from "@predictor-foundation/service-runtime";

const health = new HealthMonitor();

const loop = createTickLoop({
	intervalMs: 15_000,
	tick: async () => {
		health.markProgress();
		health.record(await doWork()); // returns a HealthStatus
	},
	onError: () => health.record("unhealthy"),
});

const app = Fastify();
registerHealthRoutes(app, { monitor: health, livenessTimeoutMs: 90_000 });
await app.listen({ port: 8080, host: "0.0.0.0" });

installGracefulShutdown({
	onShutdown: async () => {
		await loop.stop();
		await app.close();
	},
	timeoutMs: 30_000,
});

loop.start();
```

## Exports

- `HealthMonitor` - status (`starting`/`healthy`/`degraded`/`unhealthy`) for
  readiness plus a progress marker for liveness. Types: `HealthStatus`,
  `HealthSnapshot`.
- `registerHealthRoutes(app, options)` - `/healthz` (liveness from progress) and
  `/readyz` (readiness from status), with k8s-correct semantics.
- `createCachedProbe(check, ttlMs)` - memoize an async boolean dependency check
  for probe-style health (the model `faucet`'s `/healthz` uses).
- `createTickLoop(options)` - fixed-interval loop with an overlap guard and
  drain-on-stop. The tick body (health, retries, chunking) stays yours.
- `installGracefulShutdown(options)` - one-shot SIGINT/SIGTERM drain, exit 0 on
  success and 1 on a failed or timed-out drain.
