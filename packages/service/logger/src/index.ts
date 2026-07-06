// Tiny structured logger: one JSON object per line, warn/error to stderr and
// debug/info to stdout, filtered by a minimum level. Dependency-free on purpose
// so plain-Node services (schedulers, workers, CLIs) that run outside an HTTP
// framework can log without pulling in pino/winston.
//
// Lifted from heartbeat-service/src/logger.ts. The one design change on the way
// out: the minimum level is resolved at logger construction from an explicit
// argument (falling back to LOG_LEVEL, then "info"), instead of being read from
// process.env once at module load. That removes the hidden coupling to the
// environment - a caller can construct a logger at any level without mutating
// globals, which also makes it testable.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

/** Extra structured fields attached to a single line or bound to a child. */
export type LogFields = Record<string, unknown>;

/**
 * The log contract shared across Predictor services. Kept minimal and
 * structural so any compatible implementation (this one, or a Fastify/pino
 * adapter) satisfies it. Consumers that only need to *emit* logs should depend
 * on this interface, not on `createLogger`.
 */
export interface Logger {
	debug(msg: string, fields?: LogFields): void;
	info(msg: string, fields?: LogFields): void;
	warn(msg: string, fields?: LogFields): void;
	error(msg: string, fields?: LogFields): void;
	/** Derive a logger that merges `bindings` into every line it emits. */
	child(bindings: LogFields): Logger;
}

export interface LoggerOptions {
	/**
	 * Minimum level to emit. When omitted, resolved from `env.LOG_LEVEL`, then
	 * "info". An unrecognised value falls back to "info" rather than throwing -
	 * a bad log-level env var must not crash a service at boot.
	 */
	level?: LogLevel;
	/** Fields merged into every line (e.g. service name, instance id). */
	base?: LogFields;
	/** Source of the fallback `LOG_LEVEL`; defaults to `process.env`. */
	env?: Record<string, string | undefined>;
}

/** Parse an untrusted level string into a `LogLevel`, or `null` if unknown. */
export function parseLogLevel(value: string | undefined): LogLevel | null {
	return value === "debug" || value === "info" || value === "warn" || value === "error"
		? value
		: null;
}

function write(level: LogLevel, msg: string, fields: LogFields): void {
	const line = `${JSON.stringify({ level, msg, ...fields })}\n`;
	// warn/error go to stderr so log routing and alerting can split severities
	// without parsing every line.
	if (level === "warn" || level === "error") {
		process.stderr.write(line);
	} else {
		process.stdout.write(line);
	}
}

/**
 * Build a structured logger. The returned object is immutable; `child` produces
 * a new logger that shares the same threshold and merges additional bindings.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
	const env = options.env ?? process.env;
	const level = options.level ?? parseLogLevel(env.LOG_LEVEL) ?? "info";
	const minLevel = LEVEL_ORDER[level];
	const base = options.base ?? {};

	const emit = (at: LogLevel, msg: string, fields?: LogFields): void => {
		if (LEVEL_ORDER[at] < minLevel) {
			return;
		}
		write(at, msg, fields ? { ...base, ...fields } : base);
	};

	return {
		debug: (msg, fields) => emit("debug", msg, fields),
		info: (msg, fields) => emit("info", msg, fields),
		warn: (msg, fields) => emit("warn", msg, fields),
		error: (msg, fields) => emit("error", msg, fields),
		child: (bindings) => createLogger({ level, base: { ...base, ...bindings }, env }),
	};
}

/**
 * A process-wide default logger, configured from `LOG_LEVEL` at first import.
 * Prefer an explicit `createLogger` where you can (it is testable and lets you
 * bind service context); this exists for the common "just log something" case.
 */
export const logger: Logger = createLogger();
