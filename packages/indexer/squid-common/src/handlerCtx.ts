import type { BlockHeader, EventRecord } from "./handler";

/**
 * Uniform bundle handed to every event handler in every squid.
 *
 * Squids that need extra per-handler state (e.g. prediction-markets's
 * in-extrinsic trade accumulator) extend this interface and provide a
 * `makeHandlerCtx` to `createEventRouter`.
 *
 * `eventName` is the validated `EventName` (parsed via the squid's
 * `tryParseEventName` in the router). Handlers that switch on the event
 * source consume this directly instead of re-validating `event.name`
 * themselves.
 */
export interface BaseHandlerCtx<Ctx, EventName extends string> {
	ctx: Ctx;
	blockHeader: BlockHeader;
	event: EventRecord;
	eventName: EventName;
}
