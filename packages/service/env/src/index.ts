// Environment parsing primitives. Every Predictor service loads config the same
// way - "parse process.env with a Zod schema at boot, and fail loud on the
// first bad value" - and each one had hand-rolled the same three pieces:
//   1. treat an empty-string env var as unset (so a schema default can apply),
//   2. a couple of typed readers (positive int, non-empty string, port),
//   3. a fail-fast wrapper that turns Zod issues into one readable error.
//
// This package is the single source of truth for those three pieces. It is
// deliberately generic: it owns *how* env is parsed, never *which* variables a
// given service reads. Consumers compose these into their own schema and call
// `parseEnv`.

import { z } from "zod";

/**
 * Preprocessor: treat `""` (and `undefined`) as "unset". Container platforms
 * routinely inject empty strings for unset variables, which would otherwise
 * defeat a schema `.default(...)` and fail a `.min(1)`. Apply this before any
 * env reader so the absence of a value and a blank value mean the same thing.
 */
export const blankAsUndefined = (value: unknown): unknown =>
	value === "" || value === undefined ? undefined : value;

/**
 * A required, non-empty string env var. Fails if unset or blank.
 * Use for secrets and paths that have no safe default (e.g. a keys file).
 */
export function requiredString(): z.ZodType<string> {
	return z.preprocess(blankAsUndefined, z.string().min(1));
}

/** A string env var that falls back to `fallback` when unset or blank. */
export function stringEnv(fallback: string): z.ZodType<string> {
	return z.preprocess(blankAsUndefined, z.string().min(1).default(fallback));
}

/** A positive integer env var (coerced from string) with a default. */
export function positiveIntEnv(fallback: number): z.ZodType<number> {
	return z.preprocess(blankAsUndefined, z.coerce.number().int().positive().default(fallback));
}

/** A non-negative integer env var (allows 0) with a default. */
export function intEnv(fallback: number): z.ZodType<number> {
	return z.preprocess(blankAsUndefined, z.coerce.number().int().nonnegative().default(fallback));
}

/** A TCP port env var (1-65535) with a default. */
export function portEnv(fallback: number): z.ZodType<number> {
	return z.preprocess(
		blankAsUndefined,
		z.coerce.number().int().min(1).max(65_535).default(fallback),
	);
}

/**
 * A boolean env var with a default. Accepts the usual truthy/falsy spellings
 * (`true/false`, `1/0`, `yes/no`, `on/off`, case-insensitive) and rejects
 * anything else rather than silently coercing - a typo'd flag should fail the
 * boot, not quietly read as `false`.
 */
export function boolEnv(fallback: boolean): z.ZodType<boolean> {
	const TRUE = new Set(["true", "1", "yes", "on"]);
	const FALSE = new Set(["false", "0", "no", "off"]);
	return z.preprocess(
		blankAsUndefined,
		z
			.union([z.boolean(), z.string()])
			.default(fallback)
			.transform((v, ctx) => {
				if (typeof v === "boolean") {
					return v;
				}
				const normalized = v.trim().toLowerCase();
				if (TRUE.has(normalized)) {
					return true;
				}
				if (FALSE.has(normalized)) {
					return false;
				}
				ctx.addIssue({
					code: "custom",
					message: `expected a boolean (${[...TRUE, ...FALSE].join("/")}), got "${v}"`,
				});
				return z.NEVER;
			}),
	);
}

/** Format Zod issues into a single `path: message; path: message` line. */
function formatIssues(error: z.ZodError): string {
	return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

export interface ParseEnvOptions {
	/** Source of variables; defaults to `process.env`. */
	env?: Record<string, string | undefined>;
	/** Prefix for the thrown error message; defaults to "invalid environment". */
	label?: string;
}

/**
 * Parse `env` against `schema`, returning the typed config or throwing a single
 * readable error listing every offending variable. This is the fail-fast boot
 * gate: a service with bad config should abort at startup, not run degraded.
 */
export function parseEnv<T extends z.ZodType>(
	schema: T,
	options: ParseEnvOptions = {},
): z.infer<T> {
	const source = options.env ?? process.env;
	const label = options.label ?? "invalid environment";
	const parsed = schema.safeParse(source);
	if (!parsed.success) {
		throw new Error(`${label}: ${formatIssues(parsed.error)}`);
	}
	return parsed.data;
}
