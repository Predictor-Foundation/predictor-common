import type { DataHandlerContext } from "@subsquid/substrate-processor";
import type { Store } from "@subsquid/typeorm-store";

/**
 * Minimum subset of `DataHandlerContext` that `withEntity` needs. Avoids
 * pinning the helper to a specific Item parameterization (which differs
 * between squids depending on what events they subscribe to).
 */
type LoggingCtx = Pick<DataHandlerContext<Store, any>, "log">;

/** Minimum ctx shape `getOrCreateAndUpdate` needs: a store that can `save`. */
type StoreCtx = Pick<DataHandlerContext<Store, any>, "store">;

/**
 * Load + null-check + log-and-skip in one continuation-passing call.
 *
 * If the entity is present, runs `handler(entity)` and returns its result.
 * If absent, logs a structured ERROR and returns `null` without invoking
 * `handler`. The handler body sees the entity as a non-nullable `T`.
 *
 * Logged at ERROR so operators can alert on silent skips. The structured
 * payload makes the skip greppable and metric-friendly.
 *
 * `eventName` is typed by the caller's `EventName` union; passing the
 * validated name from the router (rather than a string literal) means drift
 * between log payloads and the actual subscribed event name is a type error.
 */
export async function withEntity<E extends string, T, R>(
	ctx: LoggingCtx,
	load: Promise<T | null | undefined>,
	entityName: string,
	id: string,
	eventName: E,
	handler: (entity: T) => Promise<R>,
): Promise<R | null> {
	const entity = await load;
	if (entity == null) {
		ctx.log.error(
			{ entity: entityName, id, event: eventName, action: "skip" },
			`${entityName} ${id} not found for ${eventName} — skipping`,
		);
		return null;
	}
	return await handler(entity);
}

/**
 * Idempotent upsert-or-mutate: take the row if present, otherwise build a
 * fresh one with `make()`. In both cases, run `mutate(entity)` to refresh
 * mutable fields, then save and return.
 *
 * Shape mirrors `withEntity`: the caller hands in the `Promise<T | null>`
 * from `ctx.store.get(Entity, id)` so the helper doesn't have to satisfy
 * Subsquid's `EntityClass<T>` constraint internally.
 *
 * This is the upsert pattern several handlers (notably
 * register/deregister lifecycle events) implement inline as
 * `if (existing) {...} else {...}`. One path, one save, one place for
 * subsquid mutation policy.
 */
export async function getOrCreateAndUpdate<T extends object>(
	ctx: StoreCtx,
	load: Promise<T | null | undefined>,
	make: () => T,
	mutate: (entity: T) => void,
): Promise<T> {
	const entity = (await load) ?? make();
	mutate(entity);
	// `store.save` is overloaded on Entity vs Entity[]; the generic-T cast
	// picks the single-entity overload without forcing T extends Subsquid's
	// `Entity` here.
	await (ctx.store.save as (entity: T) => Promise<void>)(entity);
	return entity;
}
