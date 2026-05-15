import { z } from "zod";
import { BlockHeightSchema } from "./primitives";

/**
 * EventMeta - extracted at the boundary of every handler. Parsed at runtime
 * by `extractEventMeta` so a future drift in the producer surfaces here.
 */
export const EventMetaSchema = z.object({
	blockNumber: BlockHeightSchema,
	timestamp: z.date(),
	extrinsicIndex: z.number().int().nonnegative(),
	eventIndex: z.number().int().nonnegative(),
	extrinsicHash: z.string().nullable(),
});
export type EventMeta = z.infer<typeof EventMetaSchema>;
