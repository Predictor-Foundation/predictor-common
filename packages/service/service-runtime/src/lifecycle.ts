import { logger as defaultLogger, type Logger } from "@predictor-foundation/logger";

// Graceful-shutdown wiring, extracted from the identical SIGINT/SIGTERM handler
// blocks in heartbeat-service/src/index.ts and faucet/packages/backend/src/index.ts.
// Both installed signal handlers that drain resources then exit; both wanted a
// failed drain to surface as a non-zero exit rather than a clean one that hides
// the failure from the orchestrator.

export interface GracefulShutdownOptions {
	/**
	 * Release resources in reverse order of acquisition (stop the scheduler,
	 * close the server, disconnect the chain, ...). Runs once. If it rejects,
	 * the process exits non-zero so a failed drain is visible to the orchestrator.
	 */
	onShutdown: (signal: NodeJS.Signals) => Promise<void>;
	/** Signals to trap; defaults to `["SIGINT", "SIGTERM"]`. */
	signals?: NodeJS.Signals[];
	/**
	 * Hard cap on the drain. If `onShutdown` has not settled within this many ms,
	 * the process force-exits non-zero rather than hanging forever (which would
	 * leave the orchestrator to SIGKILL it). Omit to wait indefinitely.
	 */
	timeoutMs?: number;
	logger?: Logger;
}

/**
 * Install a one-shot graceful-shutdown handler for the given signals. A second
 * signal received while a shutdown is already in progress is ignored, so a
 * double Ctrl-C or a SIGTERM-then-SIGINT can't run the drain twice.
 *
 * Exit codes: 0 on a clean drain, 1 on a rejected drain or the timeout.
 */
export function installGracefulShutdown(options: GracefulShutdownOptions): void {
	const signals = options.signals ?? ["SIGINT", "SIGTERM"];
	const log = options.logger ?? defaultLogger;
	let shuttingDown = false;

	const handle = (signal: NodeJS.Signals): void => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		log.info("shutting down", { signal });

		let timer: NodeJS.Timeout | undefined;
		const timeout =
			options.timeoutMs === undefined
				? undefined
				: new Promise<never>((_resolve, reject) => {
						timer = setTimeout(
							() => reject(new Error(`shutdown exceeded ${options.timeoutMs}ms`)),
							options.timeoutMs,
						);
						// Don't let the timeout timer itself keep the loop alive.
						timer.unref();
					});

		const drain = options.onShutdown(signal);
		const race = timeout ? Promise.race([drain, timeout]) : drain;

		race.then(
			() => {
				if (timer) {
					clearTimeout(timer);
				}
				process.exit(0);
			},
			(error: unknown) => {
				if (timer) {
					clearTimeout(timer);
				}
				log.error("shutdown failed", {
					error: error instanceof Error ? error.message : String(error),
				});
				process.exit(1);
			},
		);
	};

	for (const signal of signals) {
		process.on(signal, () => handle(signal));
	}
}
