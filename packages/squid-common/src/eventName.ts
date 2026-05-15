import { z } from "zod";

/**
 * Build the {`ALL_EVENTS`, `EventName`, `tryParseEventName`} bundle that
 * every squid exposes from its `schemas/eventName.ts`.
 *
 * The bundle is the single source of truth for subscribed events:
 *   - `ALL_EVENTS` drives the runtime registration in `createSubstrateProcessor`
 *   - the inferred `EventName` union types `overrides` in `createEventRouter`
 *     and every `HandlerCtx.eventName` field
 *   - `tryParseEventName` validates an incoming `event.name` at the router
 *     boundary so schema/processor drift surfaces as a structured ERROR log
 *
 * Usage:
 *
 *   export const { ALL_EVENTS, tryParseEventName } = defineEventNames([
 *     "PredictionMarkets.MarketCreated",
 *     "PredictionMarkets.MarketResolved",
 *     ...
 *   ] as const);
 *
 *   export type EventName = (typeof ALL_EVENTS)[number];
 *
 * The `as const` is necessary for the literal-union type to be inferred;
 * the factory cannot enforce it from the inside.
 */
export function defineEventNames<E extends readonly string[]>(
	events: E,
): {
	ALL_EVENTS: E;
	tryParseEventName: (name: string) => E[number] | null;
} {
	const schema = z.enum(events as unknown as [string, ...string[]]);
	return {
		ALL_EVENTS: events,
		tryParseEventName(name: string): E[number] | null {
			const r = schema.safeParse(name);
			return r.success ? (r.data as E[number]) : null;
		},
	};
}

/**
 * Split a `"Pallet.Event"` (or `"Pallet.Call"`) string into its two halves.
 * Returns `["", ""]` for malformed input so callers don't need to branch
 * on `undefined`. Centralises the pattern that recurs in handler dispatch
 * scaffolding across squids.
 */
export function splitPalletEventName(name: string): readonly [pallet: string, eventName: string] {
	const idx = name.indexOf(".");
	if (idx < 0) return ["", ""] as const;
	return [name.slice(0, idx), name.slice(idx + 1)] as const;
}
