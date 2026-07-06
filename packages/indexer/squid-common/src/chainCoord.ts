import { z } from "zod";
import { makeParserPair } from "./factory";

/**
 * Chain-coordinate row IDs.
 *
 * Every event-derived entity in a squid is keyed by the triple
 * `{blockNumber}-{extrinsicIndex}-{eventIndex}` (optionally with a
 * domain-specific `-suffix`). Re-processing a block produces the same id, so
 * `store.upsert` is idempotent and handlers do not need a dedupe path.
 *
 * One construction helper (`chainCoordIdMake`) and one parsing helper
 * (`chainCoordTransform`) so the format lives in exactly one place. To change
 * the prefix shape, edit these two functions only.
 */

export interface ChainCoord {
	blockNumber: bigint;
	extrinsicIndex: number;
	eventIndex: number;
}

/** Build the canonical chain-coord id, optionally with a `-suffix`. */
export function chainCoordIdMake(coord: ChainCoord, suffix?: string): string {
	const prefix = `${coord.blockNumber}-${coord.extrinsicIndex}-${coord.eventIndex}`;
	return suffix == null ? prefix : `${prefix}-${suffix}`;
}

/** Decimal non-negative integer string. */
const DECIMAL_INT_RE = /^\d+$/;

/**
 * Parse a chain-coord-prefixed id, optionally requiring (and stripping) a
 * fixed `-suffix`. Returns the parsed `ChainCoord` or fails the schema with a
 * structured Zod issue.
 *
 * Each component is matched against `DECIMAL_INT_RE` *before* coercion so
 * inputs that `BigInt`/`Number` would silently accept (`""` -> `0n`, `"0x1f"`
 * -> `31n`, `"1e3"` -> `1000`) fail the schema instead of producing a wrong
 * coord. Empty strings, leading `+`, hex prefixes, decimals, and exponents
 * are all rejected by construction.
 *
 * Omit `suffix` (or pass `undefined`) to parse a bare `{block}-{ext}-{evt}`
 * id. Mirrors `chainCoordIdMake`'s `suffix?: string` shape.
 */
export function chainCoordTransform(suffix?: string) {
	return (id: string, ctx: z.RefinementCtx): ChainCoord => {
		const stripped =
			suffix == null ? id : id.endsWith(`-${suffix}`) ? id.slice(0, -(suffix.length + 1)) : null;
		if (stripped == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				input: id,
				message: `Chain-coord id missing required suffix '-${suffix}'`,
			});
			return z.NEVER;
		}
		const parts = stripped.split("-");
		if (parts.length !== 3) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				input: id,
				message: "Chain-coord id must have shape '{block}-{extrinsic}-{event}[-suffix]'",
			});
			return z.NEVER;
		}
		if (!parts.every((p) => DECIMAL_INT_RE.test(p))) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				input: id,
				message:
					"Chain-coord id components must be decimal non-negative integers (no '', '0x...', '1e3', etc.)",
			});
			return z.NEVER;
		}
		return {
			blockNumber: BigInt(parts[0]),
			extrinsicIndex: Number(parts[1]),
			eventIndex: Number(parts[2]),
		};
	};
}

/**
 * The `{ schema, make, parse, assert }` bundle for a chain-coord id family.
 * `make` accepts any `ChainCoord` (an `EventMeta` structurally is one), so a
 * handler can pass its parsed meta straight in.
 */
export interface ChainCoordId {
	/** Zod schema that parses the canonical string form into a `ChainCoord`. */
	readonly schema: z.ZodType<ChainCoord, string>;
	/** Build the canonical id from a coord (or an `EventMeta`). */
	readonly make: (coord: ChainCoord) => string;
	/** `id → ChainCoord | null` (null on malformed input, no throw). */
	readonly parse: (id: string) => ChainCoord | null;
	/** `id → ChainCoord` (throws on malformed input). */
	readonly assert: (id: string) => ChainCoord;
}

/**
 * Define a chain-coord id family in one call, instead of repeating the
 * `z.string().transform(chainCoordTransform(suffix))` + `make` + `makeParserPair`
 * boilerplate per entity. Every event-derived row family in a squid has this
 * exact shape; this is the single definition of it.
 *
 * ```ts
 * export const RewardId = defineChainCoordId();          // {block}-{ext}-{evt}
 * export const VoteId   = defineChainCoordId("vote");    // {block}-{ext}-{evt}-vote
 * const id = RewardId.make(meta);                        // meta is a ChainCoord
 * ```
 *
 * Families that need renamed output fields or a composite (non-chain-coord)
 * key still hand-roll their own object; this covers the common case that the
 * remaining dozen only differ from by their suffix.
 */
export function defineChainCoordId(suffix?: string): ChainCoordId {
	const schema = z.string().transform(chainCoordTransform(suffix));
	return {
		schema,
		make: (coord: ChainCoord): string => chainCoordIdMake(coord, suffix),
		...makeParserPair(schema),
	} as const;
}
