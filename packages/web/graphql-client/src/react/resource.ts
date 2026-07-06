import type { NonFatalError } from "../errors";
import type { PageInfo } from "../pagination";

/** Re-run the underlying fetch and revalidate the cache. */
export type Refetch = () => Promise<void>;

/**
 * The state of a single fetched resource, as a discriminated union: exactly one
 * of `loading` / `error` / `notFound` / `ready` holds at any time. `data`
 * exists only in the `ready` state, so consumers cannot read it before it is
 * available, and `error` is always a `NonFatalError` (fatal errors are
 * rethrown by the hook). `refetch` is available in every state.
 */
export type Resource<T> = { refetch: Refetch } & (
	| { status: "loading" }
	| { status: "error"; error: NonFatalError }
	| { status: "notFound" }
	| { status: "ready"; data: T }
);

/**
 * The state of a fetched page of resources. `ready` guarantees at least one row
 * plus pagination metadata; a page that loaded successfully but contains no
 * rows is `empty` (not `ready` with an empty array, and not `notFound`).
 */
export type PaginatedResource<T> = { refetch: Refetch } & (
	| { status: "loading" }
	| { status: "error"; error: NonFatalError }
	| { status: "empty"; pageInfo: PageInfo; totalCount?: number }
	| { status: "ready"; data: T[]; pageInfo: PageInfo; totalCount?: number }
);
