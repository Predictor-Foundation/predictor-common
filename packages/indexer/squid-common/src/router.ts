import type { DataHandlerContext } from "@subsquid/substrate-processor";
import type { Store } from "@subsquid/typeorm-store";
import type { BlockHeader, EventRecord } from "./handler";
import type { BaseHandlerCtx } from "./handlerCtx";

/**
 * Tagged dispatch handler.
 *
 *   - `plain`   -> returns void; the router awaits and moves on.
 *   - `tracked` -> returns `R | null`; the router feeds non-null returns
 *                  through the optional `onResult` callback. Use this for
 *                  in-extrinsic accumulators (e.g. prediction-markets's
 *                  `trackTradeResult` adopting AMM/Orderbook fills into a
 *                  later HybridRouter summary event).
 *
 * Every override is built via `plain(...)` or `tracked(...)`. The "should I
 * track this trade?" decision lives once in the router instead of being
 * re-encoded at each call site.
 */
export type DispatchHandler<HCtx, R = never> =
	| { readonly kind: "plain"; readonly run: (c: HCtx) => Promise<void> }
	| { readonly kind: "tracked"; readonly run: (c: HCtx) => Promise<R | null> };

/** Factory for the `plain` (void-returning) handler variant. */
export const plain = <HCtx>(run: (c: HCtx) => Promise<void>): DispatchHandler<HCtx, never> => ({
	kind: "plain",
	run,
});

/** Factory for the `tracked` (`R | null`-returning) handler variant. */
export const tracked = <HCtx, R>(
	run: (c: HCtx) => Promise<R | null>,
): DispatchHandler<HCtx, R> => ({ kind: "tracked", run });

/** Minimal Subsquid context shape `processEvents` needs. */
type RouterCtx = Pick<DataHandlerContext<Store, unknown>, "blocks" | "log">;

const DEFAULT_NOT_HANDLED_LOG_LIMIT = 32;

/**
 * Simple router: `HCtx = BaseHandlerCtx<Ctx, EventName>` exactly. No
 * per-block state, no `tracked` result hook. Used by squids whose handlers
 * only ever produce void.
 */
export interface SimpleRouterOpts<Ctx extends RouterCtx, EventName extends string> {
	allEvents: readonly EventName[];
	tryParseEventName: (name: string) => EventName | null;
	overrides: Partial<Record<EventName, DispatchHandler<BaseHandlerCtx<Ctx, EventName>, never>>>;
	notHandledLogLimit?: number;
}

/**
 * Tracked router: extended `HCtx` (must extend `BaseHandlerCtx`), per-block
 * state, and a non-null result hook fed by `tracked` handlers. Used by
 * squids that need in-extrinsic linking (e.g. prediction-markets's
 * `extrinsicTrades` -> `HybridRouter.HybridRouterExecuted`).
 */
export interface TrackedRouterOpts<
	Ctx extends RouterCtx,
	EventName extends string,
	HCtx extends BaseHandlerCtx<Ctx, EventName>,
	BlockState,
	R,
> {
	allEvents: readonly EventName[];
	tryParseEventName: (name: string) => EventName | null;
	overrides: Partial<Record<EventName, DispatchHandler<HCtx, R>>>;
	makeBlockState: (ctx: Ctx, blockHeader: BlockHeader) => BlockState;
	makeHandlerCtx: (base: BaseHandlerCtx<Ctx, EventName>, blockState: BlockState) => HCtx;
	onResult: (handlerCtx: HCtx, result: R) => void;
	notHandledLogLimit?: number;
}

/** Build a router. Overloaded: simple (no extras) or tracked (all extras). */
export function createEventRouter<Ctx extends RouterCtx, EventName extends string>(
	opts: SimpleRouterOpts<Ctx, EventName>,
): { processEvents: (ctx: Ctx) => Promise<void> };

export function createEventRouter<
	Ctx extends RouterCtx,
	EventName extends string,
	HCtx extends BaseHandlerCtx<Ctx, EventName>,
	BlockState,
	R,
>(
	opts: TrackedRouterOpts<Ctx, EventName, HCtx, BlockState, R>,
): { processEvents: (ctx: Ctx) => Promise<void> };

/**
 * The factory wires every cross-cutting concern that both processors used to
 * re-implement:
 *   - subscribed-but-unhandled events log once per name (capped at
 *     `notHandledLogLimit`, default 32) so coverage gaps surface without
 *     spamming the log every block
 *   - schema/processor drift detection at `tryParseEventName`
 *   - per-event dispatch via a `Record<EventName, DispatchHandler>` table
 *     (compile-time complete; typos in `overrides` are TS errors)
 *   - the `tracked` path's `onResult` callback for in-extrinsic accumulators
 */
export function createEventRouter<
	Ctx extends RouterCtx,
	EventName extends string,
	HCtx extends BaseHandlerCtx<Ctx, EventName>,
	BlockState,
	R,
>(
	opts: SimpleRouterOpts<Ctx, EventName> | TrackedRouterOpts<Ctx, EventName, HCtx, BlockState, R>,
): { processEvents: (ctx: Ctx) => Promise<void> } {
	const isTracked = "makeHandlerCtx" in opts;
	const notHandledLogLimit = opts.notHandledLogLimit ?? DEFAULT_NOT_HANDLED_LOG_LIMIT;

	// Events subscribed but not explicitly routed fall through here. Logs once
	// per distinct event name (capped) so silent coverage gaps surface without
	// spamming the log on every block. The constraint `HCtx extends
	// BaseHandlerCtx<Ctx, EventName>` guarantees `c.ctx` / `c.event` are
	// present - no cast needed.
	const loggedUnhandled = new Set<string>();
	const noop: DispatchHandler<HCtx, R> = {
		kind: "plain",
		run: async (c) => {
			if (loggedUnhandled.has(c.event.name) || loggedUnhandled.size >= notHandledLogLimit) return;
			loggedUnhandled.add(c.event.name);
			c.ctx.log.info(
				{ event: c.event.name, count: loggedUnhandled.size, limit: notHandledLogLimit },
				"event subscribed but unhandled - routed to noop",
			);
		},
	};

	const defaults = Object.fromEntries(
		opts.allEvents.map((name) => [name, noop] as const),
	) as Record<EventName, DispatchHandler<HCtx, R>>;
	const handlers: Record<EventName, DispatchHandler<HCtx, R>> = {
		...defaults,
		// In the simple branch, `overrides` is typed against
		// `BaseHandlerCtx<Ctx, EventName>`; in the tracked branch, against
		// `HCtx`. Both are valid sources for the union map - the runtime
		// shape is identical.
		...(opts.overrides as Partial<Record<EventName, DispatchHandler<HCtx, R>>>),
	};

	async function processEvents(ctx: Ctx): Promise<void> {
		for (const block of ctx.blocks as Array<{
			header: BlockHeader;
			items: ReadonlyArray<{ kind: string; name: string; event?: EventRecord }>;
		}>) {
			const blockHeader = block.header;
			const blockState = isTracked
				? opts.makeBlockState(ctx, blockHeader)
				: (undefined as unknown as BlockState);

			for (const item of block.items) {
				if (item.kind !== "event") continue;
				// Validate the event name against the subscribed-event schema.
				// If Subsquid hands us an event we never registered, that's a
				// real processor/schema drift bug; surface it instead of
				// routing to the Record<EventName, ...> lookup which would
				// `undefined()`.
				const name = opts.tryParseEventName(item.name);
				if (name == null) {
					ctx.log.error(
						{ event: item.name, action: "skip" },
						`router received unsubscribed event '${item.name}' - schema/processor drift`,
					);
					continue;
				}

				const base: BaseHandlerCtx<Ctx, EventName> = {
					ctx,
					blockHeader,
					event: item.event as EventRecord,
					eventName: name,
				};
				const handlerCtx = isTracked
					? opts.makeHandlerCtx(base, blockState)
					: (base as unknown as HCtx);
				const handler = handlers[name];

				if (handler.kind === "tracked") {
					const result = await handler.run(handlerCtx);
					// In the simple branch `onResult` is undefined and tracked
					// handlers cannot exist (the overrides table won't type-check),
					// so this conditional is dead in practice.
					if (result != null && isTracked) opts.onResult(handlerCtx, result);
				} else {
					await handler.run(handlerCtx);
				}
			}
		}
	}

	return { processEvents };
}
