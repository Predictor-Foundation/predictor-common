import type { SubstrateEventP } from "@subsquid/substrate-processor/lib/interfaces/data-selection";
import type { SubstrateBlock } from "@subsquid/substrate-processor/lib/interfaces/substrate";

/**
 * The subset of Subsquid's `SubstrateBlock` handlers consume.
 *
 * Anchored to upstream via `Pick` so a Subsquid version that renames a field
 * (e.g. `height` → `number`) breaks compilation here instead of at the cast
 * site in each squid's eventRouter. Adding fields is a deliberate widening -
 * read the upstream type definition first.
 */
export type BlockHeader = Pick<SubstrateBlock, "height" | "timestamp" | "hash">;

/**
 * The subset of Subsquid's `SubstrateEventP` (the data-selection projection of
 * `SubstrateEvent`) handlers consume. `args` is `any` (mirroring upstream) so
 * typegen event decoders accept it without an extra cast.
 */
export type EventRecord = Pick<
	SubstrateEventP,
	"name" | "id" | "args" | "indexInBlock" | "extrinsic"
>;
