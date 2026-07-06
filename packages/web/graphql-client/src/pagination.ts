/**
 * Relay Connection <-> page mapping. Subsquid/Hydra GraphQL endpoints return
 * cursor-based Relay Connections; the frontend thinks in 1-based pages. These
 * types and functions translate between the two and are generic over the row
 * type - no domain types leak in.
 */

/** A 1-based pagination request. */
export interface PaginationOptions {
	page: number;
	pageSize: number;
}

/** Default page size when a caller does not specify one. */
export const DEFAULT_PAGE_SIZE = 10;

/** Resolved pagination metadata attached to a page of results. */
export interface PageInfo {
	page: number;
	pageSize: number;
	/** Total number of pages, when the connection reported a total count. */
	totalPageCount: number | undefined;
	hasPrevious: boolean;
	hasNext: boolean;
}

/**
 * A Relay Connection as returned by the GraphQL server. `C` records whether the
 * server guarantees `totalCount` (`true`) or leaves it optional (`false`), so
 * downstream code can rely on the count only when it was actually requested.
 */
export type ItemsConnection<T, C extends boolean = false> = {
	edges: { node: T }[];
	pageInfo: {
		startCursor: string;
		endCursor: string;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
} & (C extends true ? { totalCount: number } : { totalCount?: number });

/**
 * A page of already-transformed rows. `C` mirrors `ItemsConnection`'s
 * `totalCount` guarantee.
 */
export type ItemsResponse<T, C extends boolean = false> = {
	data: T[];
	pageInfo: PageInfo;
} & (C extends true ? { totalCount: number } : { totalCount?: number });

/** Translate a 1-based pagination request into Relay `first`/`after` arguments. */
export function paginationToConnectionCursor(pagination: PaginationOptions): {
	first: number;
	after: string | null;
} {
	const offset = (pagination.page - 1) * pagination.pageSize;
	return {
		first: pagination.pageSize,
		after: offset === 0 ? null : offset.toString(),
	};
}

/**
 * Map a Relay Connection into an `ItemsResponse`, transforming each node with
 * `transformNode`. To supply per-call context to the transform, close over it:
 * `extractConnectionItems(conn, pagination, (node) => transform(node, ctx))`.
 */
export async function extractConnectionItems<R, T, C extends boolean = false>(
	connection: ItemsConnection<T, C>,
	pagination: PaginationOptions,
	transformNode: (node: T) => R | Promise<R>,
): Promise<ItemsResponse<R, C>> {
	const data = await Promise.all(connection.edges.map((edge) => transformNode(edge.node)));

	const totalCount: number | undefined = connection.totalCount;
	const totalPageCount =
		totalCount === undefined ? undefined : Math.ceil(totalCount / pagination.pageSize);

	return {
		data,
		pageInfo: {
			page: pagination.page,
			pageSize: pagination.pageSize,
			totalPageCount,
			hasPrevious: connection.pageInfo.hasPreviousPage,
			hasNext: connection.pageInfo.hasNextPage,
		},
		totalCount,
	} as ItemsResponse<R, C>;
}

/**
 * Build an empty page for the given pagination request. When a `totalCount` is
 * supplied, the result is typed as having a guaranteed count (`C = true`).
 */
export function emptyItemsResponse(
	pagination: PaginationOptions,
	totalCount: number,
): ItemsResponse<never, true>;
export function emptyItemsResponse(
	pagination?: PaginationOptions,
	totalCount?: undefined,
): ItemsResponse<never, false>;
export function emptyItemsResponse(
	pagination: PaginationOptions = { page: 1, pageSize: DEFAULT_PAGE_SIZE },
	totalCount?: number,
): ItemsResponse<never> {
	return {
		data: [],
		pageInfo: {
			page: pagination.page,
			pageSize: pagination.pageSize,
			totalPageCount:
				totalCount === undefined ? undefined : Math.ceil(totalCount / pagination.pageSize),
			hasPrevious: false,
			hasNext: false,
		},
		totalCount,
	};
}
