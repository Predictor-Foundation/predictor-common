import type { EntityClass, FindManyOptions, FindOneOptions, Store } from "@subsquid/typeorm-store";

/**
 * Read-through / write-through cache over a TypeORM `Store`.
 *
 * The two block-explorer squids (account, stats) each carried a
 * hand-rolled "StoreWithCache" class (~200 lines apiece, diverged in
 * subtle ways). This is the shared replacement: one cache keyed by
 * entity class, drop-in for the existing API.
 *
 * Cache semantics:
 *
 *  - `get` / `getOrFail` hit the cache first; on miss they delegate to
 *    `store.get`, then populate the cache. Subsequent reads of the same
 *    `(entityClass, id)` within the batch return the cached instance -
 *    which is the same object the caller may have mutated, so reads
 *    after writes see the writer's state.
 *  - `insert` / `upsert` / `save` delegate, then populate the cache for
 *    every entity by its `id`. `remove` invalidates.
 *  - `find` / `findOne` / `count` delegate without touching the cache:
 *    these queries return arbitrary subsets keyed on `where` clauses,
 *    not on `id`, so a cached `get` after a `find` would have to do its
 *    own miss check anyway. Keeping these uncached makes the cache
 *    invariant simple: "cached(entity) ⇒ matches the row most recently
 *    written or read by id in this batch."
 *  - `flush` is a no-op. Subsquid's `Store` flushes on its own; the
 *    method exists so existing call sites (`await ctx.store.flush()`
 *    at the end of a batch) can stay unchanged.
 *
 * The cache is keyed by the entity class object itself (via WeakMap)
 * rather than by `entityClass.name`. Two classes that happen to share a
 * name (e.g. across packages) get separate caches.
 */
export interface EntityCache {
	get<T extends { id: string }>(entityClass: EntityClass<T>, id: string): Promise<T | undefined>;
	getOrFail<T extends { id: string }>(entityClass: EntityClass<T>, id: string): Promise<T>;
	find<T extends { id: string }>(
		entityClass: EntityClass<T>,
		options?: FindManyOptions<T>,
	): Promise<T[]>;
	findOne<T extends { id: string }>(
		entityClass: EntityClass<T>,
		options: FindOneOptions<T>,
	): Promise<T | undefined>;
	insert<T extends { id: string }>(entity: T | T[]): Promise<void>;
	upsert<T extends { id: string }>(entity: T | T[]): Promise<void>;
	save<T extends { id: string }>(entity: T | T[]): Promise<void>;
	remove<T extends { id: string }>(entity: T | T[]): Promise<void>;
	count<T extends { id: string }>(
		entityClass: EntityClass<T>,
		options?: FindManyOptions<T>,
	): Promise<number>;
	flush(): Promise<void>;
}

export function createEntityCache(store: Store): EntityCache {
	const cache = new WeakMap<EntityClass<any>, Map<string, any>>();

	function cacheFor<T>(entityClass: EntityClass<T>): Map<string, T> {
		let c = cache.get(entityClass);
		if (!c) {
			c = new Map();
			cache.set(entityClass, c);
		}
		return c as Map<string, T>;
	}

	function populate<T extends { id: string }>(entities: T[]): void {
		for (const e of entities) {
			cacheFor(e.constructor as EntityClass<T>).set(e.id, e);
		}
	}

	function invalidate<T extends { id: string }>(entities: T[]): void {
		for (const e of entities) {
			cacheFor(e.constructor as EntityClass<T>).delete(e.id);
		}
	}

	return {
		async get(entityClass, id) {
			const c = cacheFor(entityClass);
			if (c.has(id)) return c.get(id);
			const entity = await store.get(entityClass, id);
			if (entity) c.set(id, entity);
			return entity;
		},
		async getOrFail(entityClass, id) {
			const c = cacheFor(entityClass);
			let entity = c.get(id);
			if (!entity) {
				entity = await store.get(entityClass, id);
				if (!entity) {
					throw new Error(`${entityClass.name} with id ${id} not found`);
				}
				c.set(id, entity);
			}
			return entity;
		},
		find(entityClass, options) {
			return store.find(entityClass, options) as Promise<any>;
		},
		findOne(entityClass, options) {
			return store.findOne(entityClass, options) as Promise<any>;
		},
		async insert(entity) {
			const entities = Array.isArray(entity) ? entity : [entity];
			if (entities.length === 0) return;
			await store.insert(entities);
			populate(entities);
		},
		async upsert(entity) {
			const entities = Array.isArray(entity) ? entity : [entity];
			if (entities.length === 0) return;
			await store.upsert(entities);
			populate(entities);
		},
		async save(entity) {
			const entities = Array.isArray(entity) ? entity : [entity];
			if (entities.length === 0) return;
			await store.upsert(entities);
			populate(entities);
		},
		async remove(entity) {
			const entities = Array.isArray(entity) ? entity : [entity];
			if (entities.length === 0) return;
			await store.remove(entities);
			invalidate(entities);
		},
		count(entityClass, options) {
			return store.count(entityClass, options);
		},
		async flush() {
			// No-op: Subsquid's Store flushes on its own. Method exists
			// for call-site compatibility with the older StoreWithCache.
		},
	};
}
