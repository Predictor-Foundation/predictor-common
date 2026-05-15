import { z } from "zod";

/**
 * Date argument from GraphQL. `coerce.date()` accepts any input that
 * `new Date(...)` parses without yielding `Invalid Date`; the `.refine` closes
 * the `Invalid Date` hole.
 */
export const DateInput = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), {
	message: "Invalid date - must be ISO 8601 (e.g. '2025-04-15T14:30:00Z')",
});

/**
 * Composite date-range with the `start <= end` invariant baked into the
 * schema. Resolvers don't have to repeat the `if (start > end)` check.
 */
export const DateRangeInput = z
	.object({ startTime: DateInput, endTime: DateInput })
	.refine((r) => r.startTime <= r.endTime, {
		message: "startTime must be before or equal to endTime",
		path: ["startTime"],
	});

/** Default pagination max - resolvers may override. */
export const MAX_QUERY_LIMIT = 1000;
export const LimitInput = z.number().int().min(1).max(MAX_QUERY_LIMIT);
export const OffsetInput = z.number().int().min(0);

/**
 * Parse a resolver argument bundle through a Zod schema, throwing a structured
 * error on failure. type-graphql expects throws (it catches and reports them
 * as GraphQL errors), so we lean into that - `null` returns would silently
 * become missing fields downstream.
 *
 * The thrown message includes the failing path(s) so the consumer learns
 * *which* argument was invalid, not just that "something" was wrong.
 */
export function parseArgs<T>(schema: z.ZodType<T>, args: unknown, queryName: string): T {
	const result = schema.safeParse(args);
	if (result.success) return result.data;
	const issues = result.error.issues
		.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
		.join("; ");
	throw new Error(`Invalid arguments to ${queryName}: ${issues}`);
}
