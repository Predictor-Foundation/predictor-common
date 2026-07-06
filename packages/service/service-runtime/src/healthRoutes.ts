import type { FastifyInstance } from "fastify";
import type { HealthMonitor } from "./health";

export interface HealthRoutesOptions {
	monitor: HealthMonitor;
	/**
	 * Liveness window. The loop is "alive" if it signalled progress within this
	 * many ms. Size it to comfortably exceed the longest legitimate gap between
	 * two progress markers (a slow submit awaiting finalization, a read timeout,
	 * the largest retry-backoff sleep, plus slack), so a genuine wait never trips
	 * a restart while a wedged loop still does.
	 */
	livenessTimeoutMs: number;
	/** Liveness path; defaults to `/healthz`. */
	livenessPath?: string;
	/** Readiness path; defaults to `/readyz`. */
	readinessPath?: string;
	/** Clock, injectable for tests; defaults to `Date.now`. */
	now?: () => number;
}

/**
 * Register k8s-correct liveness + readiness routes backed by a `HealthMonitor`.
 *
 *   liveness  (`/healthz`) - 200 while the loop signalled progress within
 *     `livenessTimeoutMs`, else 503. Independent of dependency reachability and
 *     of degraded state, so an external outage or a single bad item never
 *     triggers a restart a restart cannot fix. Before the first progress
 *     signal, staleness is measured from registration time, so a loop that
 *     wedges at startup still fails liveness once the window lapses.
 *
 *   readiness (`/readyz`) - served from the last recorded status, never a live
 *     dependency round-trip inside the handler (so a frequent probe can't block
 *     and flap the pod). `healthy` and `degraded` are ready; `starting` and
 *     `unhealthy` are not.
 */
export function registerHealthRoutes(app: FastifyInstance, options: HealthRoutesOptions): void {
	const { monitor, livenessTimeoutMs } = options;
	const now = options.now ?? Date.now;
	const livenessPath = options.livenessPath ?? "/healthz";
	const readinessPath = options.readinessPath ?? "/readyz";
	const registeredAt = now();

	app.get(livenessPath, async (_req, reply) => {
		const { lastProgressAt, lastCompletedAt } = monitor.snapshot();
		const reference = lastProgressAt === 0 ? registeredAt : lastProgressAt;
		const alive = now() - reference < livenessTimeoutMs;
		return reply.code(alive ? 200 : 503).send({ alive, lastProgressAt, lastCompletedAt });
	});

	app.get(readinessPath, async (_req, reply) => {
		const { status } = monitor.snapshot();
		const ready = status === "healthy" || status === "degraded";
		return reply.code(ready ? 200 : 503).send({ ready, status });
	});
}

/**
 * Memoize an async boolean check for `ttlMs`. Use for a probe-style health
 * check that round-trips an external dependency (e.g. "is the chain
 * reachable?"): the cache stops a frequent liveness probe from being used to
 * hammer that dependency. A thrown check resolves to `false` (unreachable).
 *
 * This is the counterpart to `registerHealthRoutes` for services whose health
 * *is* a live dependency check rather than a work-progress marker - keep the two
 * models separate rather than forcing one to express the other.
 */
export function createCachedProbe(
	check: () => Promise<boolean>,
	ttlMs: number,
	now: () => number = Date.now,
): () => Promise<boolean> {
	let checkedAt = 0;
	let healthy = false;
	let inFlight: Promise<boolean> | undefined;

	return async () => {
		const at = now();
		if (at - checkedAt <= ttlMs && checkedAt !== 0) {
			return healthy;
		}
		// Collapse concurrent refreshes so a burst of probes triggers one check.
		if (!inFlight) {
			inFlight = check()
				.catch(() => false)
				.then((result) => {
					healthy = result;
					checkedAt = now();
					inFlight = undefined;
					return result;
				});
		}
		return inFlight;
	};
}
