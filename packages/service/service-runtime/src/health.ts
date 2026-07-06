// Health state machine for a long-lived worker. Lifted from
// heartbeat-service/src/health.ts, which was already chain- and
// domain-agnostic: it records a coarse status from each unit of work and tracks
// a liveness "progress" marker that is deliberately decoupled from work
// completion.

/**
 * Coarse service status, ordered by severity. Drives readiness:
 *   starting  - no unit of work has completed yet; not ready until the first one
 *               confirms the service can do its job
 *   healthy   - the last unit of work completed cleanly
 *   degraded  - the work ran but partially failed; still ready, because the
 *               service is doing its job for the rest of the workload
 *   unhealthy - the service performed no useful work (the unit failed outright,
 *               or every item in it failed); not ready
 */
export type HealthStatus = "starting" | "healthy" | "degraded" | "unhealthy";

export interface HealthSnapshot {
	status: HealthStatus;
	/** Wall-clock ms of the last *completed* unit of work (0 = none yet). */
	lastCompletedAt: number;
	/** Wall-clock ms of the last progress signal (0 = none yet). */
	lastProgressAt: number;
}

/**
 * Tracks service health from work outcomes.
 *
 * `status` drives readiness (`/readyz`). `lastProgressAt` drives liveness
 * (`/healthz`) and is separate from *completion* on purpose: `markProgress()`
 * advances it whenever the loop is demonstrably alive and attempting work (a
 * unit starts, a chunk boundary is crossed, an attempt settles), so a slow unit
 * stuck awaiting a finalization or in retry-backoff against an unreachable
 * dependency still reads as alive and is not killed by a liveness probe that a
 * restart could not fix. A completed `record` advances it too.
 *
 * `now` is injectable for testing; it defaults to `Date.now`.
 */
export class HealthMonitor {
	private status: HealthStatus = "starting";
	private lastCompletedAt = 0;
	private lastProgressAt = 0;
	private readonly now: () => number;

	constructor(now: () => number = Date.now) {
		this.now = now;
	}

	/** Record the outcome of a completed unit of work; also counts as progress. */
	record(status: HealthStatus): void {
		this.status = status;
		const at = this.now();
		this.lastCompletedAt = at;
		this.lastProgressAt = at;
	}

	/** The loop is alive and making attempts (work start / chunk / settle). */
	markProgress(): void {
		this.lastProgressAt = this.now();
	}

	snapshot(): HealthSnapshot {
		return {
			status: this.status,
			lastCompletedAt: this.lastCompletedAt,
			lastProgressAt: this.lastProgressAt,
		};
	}
}
