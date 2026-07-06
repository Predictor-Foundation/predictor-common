import type { z } from "zod";

/**
 * Build a `{ parse, assert }` pair from any Zod schema.
 *
 *   - `parse(input)`  → `Output | null`  on validation failure (no throw)
 *   - `assert(input)` → `Output`         throws on validation failure
 *
 * Eliminates the boilerplate of writing the same `safeParse → r.success
 * ? r.data : null` block once per primitive.
 */
export function makeParserPair<S extends z.ZodType>(schema: S) {
	type Input = z.input<S>;
	type Output = z.output<S>;
	return {
		parse(input: Input): Output | null {
			const r = schema.safeParse(input);
			return r.success ? r.data : null;
		},
		assert(input: Input): Output {
			return schema.parse(input);
		},
	} as const;
}
