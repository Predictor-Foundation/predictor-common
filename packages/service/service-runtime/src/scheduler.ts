// The generic tick-loop skeleton, extracted from heartbeat-service/src/scheduler.ts.
// It owns exactly the scheduling concerns that every periodic worker repeats -
// fixed-interval firing, an overlap guard so ticks never stack, and draining the
// in-flight tick on stop - and nothing about what a tick *does*. The domain work
// is the injected `tick` callback; health recording, retries, and chunking stay
// in that callback where the domain lives.

export interface TickLoop {
	/** Fire one tick immediately, then every `intervalMs`. Idempotent. */
	start(): void;
	/** Stop scheduling and await the in-flight tick (graceful drain). */
	stop(): Promise<void>;
}

export interface TickLoopOptions {
	intervalMs: number;
	/**
	 * The work to run each tick. Runs at most once concurrently: if a tick is
	 * still in flight when the interval fires, that firing is skipped.
	 */
	tick: () => Promise<void>;
	/**
	 * Called if `tick` rejects. Use it to record health/log; the loop itself
	 * swallows the rejection and keeps scheduling. If omitted, a rejected tick
	 * is silently absorbed (so an unobserved throw can't crash the process).
	 */
	onError?: (error: unknown) => void;
}

/**
 * Build a self-guarding periodic loop. The overlap guard means `tick` is never
 * re-entered; `stop()` resolves only once any in-flight tick has settled, so a
 * caller can safely tear down shared resources afterwards.
 */
export function createTickLoop(options: TickLoopOptions): TickLoop {
	const { intervalMs, tick, onError } = options;
	let timer: NodeJS.Timeout | undefined;
	let running = false;
	let stopped = false;
	let inFlight: Promise<void> | undefined;

	const runTick = async (): Promise<void> => {
		try {
			await tick();
		} catch (error) {
			onError?.(error);
		}
	};

	const kick = (): void => {
		if (stopped || running) {
			return;
		}
		running = true;
		inFlight = runTick().finally(() => {
			running = false;
		});
	};

	return {
		start(): void {
			if (timer) {
				return;
			}
			kick();
			timer = setInterval(kick, intervalMs);
		},
		async stop(): Promise<void> {
			stopped = true;
			if (timer) {
				clearInterval(timer);
				timer = undefined;
			}
			if (inFlight) {
				await inFlight.catch(() => {});
			}
		},
	};
}
