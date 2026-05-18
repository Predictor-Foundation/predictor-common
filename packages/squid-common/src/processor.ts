import {
	type BatchProcessorItem,
	type DataHandlerContext,
	SubstrateBatchProcessor,
} from "@subsquid/substrate-processor";
import type { Store } from "@subsquid/typeorm-store";
import type { ProcessorConfig } from "./config";

/**
 * `processor.addEvent` data-selection used by every squid in the repo.
 *
 * `indexInBlock` is NOT auto-included by Subsquid (only `id`, `name`, `pos`
 * are); without requesting it explicitly, `event.indexInBlock` arrives
 * undefined and the shared `EventMetaSchema` rejects it. The same
 * requirement applies to `extrinsic.indexInBlock` - both are needed to
 * compose chain-coord row ids.
 *
 * Exported as a const so a per-squid `createSubstrateProcessor` call needs
 * no `eventConfig:` argument in the common case; squids that need a
 * different projection can pass their own.
 */
export const DEFAULT_EVENT_CONFIG = {
	data: {
		event: {
			args: true,
			indexInBlock: true,
			extrinsic: {
				signature: true,
				hash: true,
				indexInBlock: true,
			},
			call: { origin: true, args: true },
		},
	},
} as const;

export type DefaultEventConfig = typeof DEFAULT_EVENT_CONFIG;

/**
 * Configure a `SubstrateBatchProcessor` from the shared `ProcessorConfig`
 * plus a list of subscribed events and/or calls. The factory wires
 * `setDataSource`, `setBlockRange`, optional `includeAllBlocks()`, the
 * per-event `addEvent` loop, and the per-call `addCall` loop. Anything
 * more bespoke goes in the per-squid `processor.ts`.
 *
 * The optional generic `Item` parameter is what preserves the per-item
 * type narrowing downstream consumers rely on via
 * `BatchProcessorItem<typeof processor>` - omitting it returns a bare
 * `SubstrateBatchProcessor` (fine for handler-router squids); declaring it
 * matches the explicit `new SubstrateBatchProcessor<EventItem_<E,...> |
 * CallItem_<C,...>>()` pattern used by squids whose dispatch needs name
 * narrowing.
 *
 * Usage (event-only, no narrowing):
 *
 *   export default createSubstrateProcessor({ config, events: ALL_EVENTS });
 *
 * Usage (events + calls, with narrowing):
 *
 *   export const processor = createSubstrateProcessor<
 *     | EventItem_<EventName, EventProjection>
 *     | CallItem_<CallName, CallProjection>
 *   >({
 *     config,
 *     events: ALL_EVENTS,
 *     calls: ALL_CALLS,
 *     eventConfig: EVENT_DATA,
 *     callConfig: CALL_DATA,
 *     includeAllBlocks: true,
 *   });
 */
/**
 * `SubstrateBatchProcessor`'s `Item` constraint - re-exposed here so the
 * factory's default type parameter satisfies it. The shape is the union of
 * every `EventItem<...>` and `CallItem<...>` Subsquid can emit.
 */
type ProcessorItemConstraint = { kind: string; name: string };

export function createSubstrateProcessor<
	Item extends ProcessorItemConstraint = ProcessorItemConstraint,
>(opts: {
	config: ProcessorConfig;
	events?: readonly string[];
	calls?: readonly string[];
	eventConfig?: unknown;
	callConfig?: unknown;
	includeAllBlocks?: boolean;
}): SubstrateBatchProcessor<Item> {
	if (!opts.events?.length && !opts.calls?.length) {
		throw new Error(
			"createSubstrateProcessor: at least one of `events` or `calls` must be non-empty",
		);
	}

	const processor = new SubstrateBatchProcessor<Item>()
		.setDataSource(opts.config.dataSource)
		.setBlockRange(opts.config.blockRange);

	if (opts.includeAllBlocks) {
		processor.includeAllBlocks();
	}

	const eventConfig = opts.eventConfig ?? DEFAULT_EVENT_CONFIG;
	for (const event of opts.events ?? []) {
		processor.addEvent(event, eventConfig as DefaultEventConfig);
	}
	for (const call of opts.calls ?? []) {
		processor.addCall(call, opts.callConfig as Parameters<typeof processor.addCall>[1]);
	}
	return processor;
}

/**
 * Convenience aliases for per-squid `Ctx` type definitions. Each squid still
 * exports its own `Ctx` (the `Item` parameterization depends on which events
 * the squid subscribes to, so it cannot be pre-baked here), but the
 * factory-built processor satisfies the same shape upstream code expects.
 */
export type DefaultProcessor = SubstrateBatchProcessor;
// `<P extends SubstrateBatchProcessor<any>>` (not just `SubstrateBatchProcessor`)
// because the factory's default Item is wider than `SubstrateBatchProcessor`'s
// own default, so the narrower form rejects `typeof processor` in consumers.
export type ProcessorItem<P extends SubstrateBatchProcessor<any>> = BatchProcessorItem<P>;
export type ProcessorCtx<P extends SubstrateBatchProcessor<any>> = DataHandlerContext<
	Store,
	ProcessorItem<P>
>;
