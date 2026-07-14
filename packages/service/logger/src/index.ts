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
	/**
	 * Words/field names (matched at any depth) whose values are replaced with `[redacted]` before a line
	 * is written. Matching is by WORD BOUNDARY, not exact equality: a field is redacted if its full
	 * lower-cased name is in the set, OR any of its camelCase / snake_case / kebab-case words is - so
	 * `token` catches `accessToken`, `refresh_token`, and `auth-token` alike. Defaults to
	 * {@link DEFAULT_REDACT_KEYS}. Pass `[]` to disable. Redaction is by KEY, not by value shape: a secret
	 * seed and an on-chain tx hash are both `0x`+64 hex, so value-pattern redaction would destroy the tx
	 * hashes/addresses you actually want in logs. This biases toward OVER-redaction: an ambiguous field
	 * like `seedNode` or `tokenCount` is redacted because it contains a sensitive word, which is the safe
	 * default for a security feature. Keep secrets in named fields (never interpolated into `msg`).
	 */
	redactKeys?: readonly string[];
}

/**
 * Words redacted by default. Because matching is by WORD BOUNDARY (see {@link LoggerOptions.redactKeys}),
 * a single word like `secret` also covers `clientSecret`, `secret_key`, and `secret-key`; the entries
 * below that are joined compounds (`apikey`, `privatekey`, `secretkey`, `minisecret`) exist only to catch
 * the forms whose words - `api`, `key`, `mini` - are too generic to redact on their own. Covers the
 * secret material a chain service might accidentally pass in a log field - secret URIs, seeds, mnemonics,
 * private keys, passwords, tokens, credentials, authorization headers.
 */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
	"suri",
	"secret",
	"seed",
	"mnemonic",
	"password",
	"token",
	"credential",
	"credentials",
	"authorization",
	"apikey",
	"privatekey",
	"secretkey",
	"minisecret",
];

/** The marker a redacted value is replaced with. */
const REDACTED = "[redacted]";
/** The marker substituted for a value already seen on the current path (an accidental cycle). */
const CIRCULAR = "[circular]";

/** True only for a `{}`-style record; the sole object kind {@link redact} traverses and rebuilds. */
function isPlainRecord(value: object): boolean {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/**
 * Split a field name into lower-cased words on camelCase boundaries and `_`, `-`, and digit separators,
 * so `accessToken` -> `["access", "token"]` and `db_password` -> `["db", "password"]`. Used by
 * {@link isRedactKey} to catch compound names whose sensitive part is only one word.
 */
function splitWords(name: string): string[] {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.split(/[^a-zA-Z]+/)
		.filter((w) => w.length > 0)
		.map((w) => w.toLowerCase());
}

/** A field is redacted if its full lower-cased name is in `keys`, or any of its words is. */
function isRedactKey(name: string, keys: Set<string>): boolean {
	if (keys.has(name.toLowerCase())) return true;
	return splitWords(name).some((w) => keys.has(w));
}

/**
 * Deep-copy `value`, replacing any value whose key matches `keys` (see {@link isRedactKey}) with {@link REDACTED}.
 * Only arrays and plain records are traversed and rebuilt; a `Date`, `Map`/`Set`, typed array, `Error`,
 * or class instance is passed through untouched, so redaction never degrades its serialization (a `Date`
 * must still log as its ISO string, not `{}`). `seen` guards against an accidental reference cycle
 * recursing until the stack overflows before `write` could stringify it.
 */
function redact(value: unknown, keys: Set<string>, seen: WeakSet<object> = new WeakSet()): unknown {
	// `seen` is PATH-scoped (added before descending, removed after) so a true cycle renders as
	// "[circular]" while a value merely aliased under two sibling keys (a diamond) still serializes fully.
	if (Array.isArray(value)) {
		if (seen.has(value)) return CIRCULAR;
		seen.add(value);
		const mapped = value.map((v) => redact(v, keys, seen));
		seen.delete(value);
		return mapped;
	}
	if (value !== null && typeof value === "object") {
		if (!isPlainRecord(value)) return value; // Date, Map/Set, Error, typed array, class instance
		if (seen.has(value)) return CIRCULAR;
		seen.add(value);
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = isRedactKey(k, keys) ? REDACTED : redact(v, keys, seen);
		}
		seen.delete(value);
		return out;
	}
	return value;
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
	const redactKeys = new Set(
		(options.redactKeys ?? DEFAULT_REDACT_KEYS).map((k) => k.toLowerCase()),
	);

	const emit = (at: LogLevel, msg: string, fields?: LogFields): void => {
		if (LEVEL_ORDER[at] < minLevel) {
			return;
		}
		const merged = fields ? { ...base, ...fields } : base;
		write(at, msg, redactKeys.size > 0 ? (redact(merged, redactKeys) as LogFields) : merged);
	};

	return {
		debug: (msg, fields) => emit("debug", msg, fields),
		info: (msg, fields) => emit("info", msg, fields),
		warn: (msg, fields) => emit("warn", msg, fields),
		error: (msg, fields) => emit("error", msg, fields),
		// Carry redactKeys into children so a bound sub-logger keeps the same redaction policy.
		child: (bindings) =>
			createLogger({ level, base: { ...base, ...bindings }, env, redactKeys: options.redactKeys }),
	};
}

/**
 * A process-wide default logger, configured from `LOG_LEVEL` at first import.
 * Prefer an explicit `createLogger` where you can (it is testable and lets you
 * bind service context); this exists for the common "just log something" case.
 */
export const logger: Logger = createLogger();
