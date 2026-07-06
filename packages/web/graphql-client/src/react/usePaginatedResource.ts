import { useMemo } from "react";

import { DEFAULT_PAGE_SIZE, type ItemsResponse, type PaginationOptions } from "../pagination";
import type { PaginatedResource, Refetch } from "./resource";
import { type UseResourceOptions, useResource } from "./useResource";

export interface UsePaginatedResourceOptions extends UseResourceOptions {
	/** 1-based page number. Default 1. */
	page?: number;
	/** Rows per page. Default `DEFAULT_PAGE_SIZE`. */
	pageSize?: number;
}

/**
 * Fetch a page of resources via SWR and expose it as a discriminated
 * `PaginatedResource`. The fetcher receives the caller's `args` plus a trailing
 * `PaginationOptions` and returns an `ItemsResponse`. A successfully fetched but
 * empty page resolves to `empty`; only a non-empty page is `ready`.
 */
export function usePaginatedResource<T, Args extends unknown[]>(
	fetchItems: (
		...args: [...Args, PaginationOptions]
	) => ItemsResponse<T> | Promise<ItemsResponse<T>>,
	args: Args,
	options: UsePaginatedResourceOptions = {},
): PaginatedResource<T> {
	const { page = 1, pageSize = DEFAULT_PAGE_SIZE, revalidateOnFocus = false, ...rest } = options;

	const pagination: PaginationOptions = { page, pageSize };

	const resource = useResource(fetchItems, [...args, pagination] as [...Args, PaginationOptions], {
		...rest,
		revalidateOnFocus,
	});

	return useMemo<PaginatedResource<T>>(() => {
		const refetch: Refetch = resource.refetch;

		switch (resource.status) {
			case "loading":
				return { status: "loading", refetch };
			case "error":
				return { status: "error", error: resource.error, refetch };
			case "notFound":
				return {
					status: "empty",
					pageInfo: {
						page,
						pageSize,
						totalPageCount: undefined,
						hasPrevious: false,
						hasNext: false,
					},
					refetch,
				};
			case "ready": {
				const response = resource.data;
				if (response.data.length === 0) {
					return {
						status: "empty",
						pageInfo: response.pageInfo,
						totalCount: response.totalCount,
						refetch,
					};
				}
				return {
					status: "ready",
					data: response.data,
					pageInfo: response.pageInfo,
					totalCount: response.totalCount,
					refetch,
				};
			}
		}
	}, [resource, page, pageSize]);
}
