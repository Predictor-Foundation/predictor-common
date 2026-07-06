import { type EventMeta, EventMetaSchema } from "./domain";
import type { BlockHeader, EventRecord } from "./handler";

export type { EventMeta } from "./domain";

/**
 * Extract validated EventMeta from the boundary. Runs through `EventMetaSchema`
 * so any future drift in the producer (e.g. a `Date(undefined)` from a Subsquid
 * version that drops `blockHeader.timestamp`) fails loud here.
 */
export function extractEventMeta(blockHeader: BlockHeader, event: EventRecord): EventMeta {
	return EventMetaSchema.parse({
		blockNumber: BigInt(blockHeader.height),
		timestamp: new Date(blockHeader.timestamp),
		extrinsicIndex: event.extrinsic?.indexInBlock ?? 0,
		eventIndex: event.indexInBlock,
		extrinsicHash: event.extrinsic?.hash ?? null,
	});
}
