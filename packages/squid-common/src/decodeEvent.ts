import type { z } from "zod";
import type { EventRecord } from "./handler";

/**
 * Typegen event classes expose one `isVxx`/`asVxx` pair per signature version
 * the chain has gone through (e.g. `isV3`/`asV3` for an event introduced at
 * spec v3, plus `isV30`/`asV30` if the payload shape changed at v30).
 *
 * `PayloadOf<C>` walks every accessor whose name matches `asV<number>` on the
 * class instance and yields the union of their return types. For events that
 * have a single supported version it collapses to that version's payload; for
 * events with multiple supported versions the call site receives a union and
 * narrows by destructuring (every version shares the same field set by
 * convention).
 *
 * Why not require a specific `asV3`? Events introduced after the runtime's v3
 * (e.g. `NodeManager.NodeDeregistered` at v30) have only `asV30` and would be
 * rejected by a hard-coded `asV3` constraint - the original bug that motivated
 * the refactor away from `decodeV3`.
 */
type AsAccessors<I> = {
	[K in keyof I as K extends `asV${number}` ? K : never]: I[K];
};
type PayloadOf<C> = C extends new (
	...args: any[]
) => infer I
	? AsAccessors<I> extends infer A
		? A[keyof A]
		: never
	: never;

/**
 * Structural constraint on the constructor passed to `decodeEvent`. Accepts
 * any class with at least one `asV<number>` accessor and any `isV<number>`
 * companion flags. The decoded payload type is inferred via `PayloadOf<C>`.
 */
export type EventDecoderCtor = new (ctx: any, event: any) => unknown;

/** Pattern matching typegen's `isVxx` accessor naming. */
const VERSION_FLAG_RE = /^isV(\d+)$/;

/**
 * Decode a typegen event payload by trying every `isVxx` accessor the class
 * exposes (in descending numeric order) and returning the first `asVxx`
 * whose `isVxx` is true.
 *
 * Throws when no `isVxx` matches: the only legitimate cause is a runtime
 * upgrade that introduced a new event signature not yet captured in typegen.
 * The error names both the event class and the spec versions it knows about
 * so the operator can run `pnpm typegen` against fresh metadata.
 *
 * Optional `schema` parameter: when supplied, the decoded payload is run
 * through the schema before being returned. Use this to surface typegen-vs-
 * runtime drift at the boundary.
 */
export function decodeEvent<C extends EventDecoderCtor>(
	EventClass: C,
	ctx: unknown,
	event: EventRecord,
	schema?: z.ZodType<PayloadOf<C>>,
): PayloadOf<C> {
	const decoded = new EventClass(ctx, event) as Record<string, any>;

	const versions = new Set<number>();
	for (const key of Object.keys(decoded)) {
		const m = VERSION_FLAG_RE.exec(key);
		if (m) versions.add(parseInt(m[1], 10));
	}
	for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(decoded))) {
		const m = VERSION_FLAG_RE.exec(key);
		if (m) versions.add(parseInt(m[1], 10));
	}
	const sorted = [...versions].sort((a, b) => b - a);

	for (const v of sorted) {
		if (decoded[`isV${v}`] === true) {
			const payload = decoded[`asV${v}`] as PayloadOf<C>;
			return schema ? schema.parse(payload) : payload;
		}
	}

	throw new Error(
		`Unsupported event version for ${EventClass.name}; ` +
			`typegen knows about [${sorted.join(",")}] but none matched the runtime hash. ` +
			`Re-run \`pnpm typegen\` against fresh chain metadata.`,
	);
}
