import { useEffect, useMemo } from "react";
import useSwr, { type SWRConfiguration } from "swr";

import { NonFatalError } from "../errors";
import type { Refetch, Resource } from "./resource";

export interface UseResourceOptions extends SWRConfiguration {
	/**
	 * When true, the fetch is skipped and the resource resolves to `notFound`
	 * without calling the fetcher. Use for data that is only conditionally
	 * needed.
	 */
	skip?: boolean;
	/**
	 * Poll interval in milliseconds. Omit to disable polling. (Presence enables
	 * polling, so there is no separate on/off flag to keep in sync.)
	 */
	refreshIntervalMs?: number;
}

type Fetcher<T, Args extends unknown[]> = (...args: Args) => T | undefined | Promise<T | undefined>;

/**
 * Fetch a single resource via SWR and expose it as a discriminated `Resource`.
 *
 * The fetcher may return `undefined` to signal "not found". Any thrown value
 * that is not a `NonFatalError` is rethrown to the nearest React error
 * boundary; only `NonFatalError` reaches the `error` state.
 */
export function useResource<T, Args extends unknown[]>(
	fetchItem: Fetcher<T, Args>,
	args: Args,
	options: UseResourceOptions = {},
): Resource<T> {
	const { skip, refreshIntervalMs, ...swrOptions } = options;

	const swrKey = skip ? null : ([fetchItem, args] as const);

	const { data, isLoading, error, mutate } = useSwr(swrKey, callFetcher<T, Args>, {
		...swrOptions,
		refreshInterval: refreshIntervalMs,
	});

	useEffect(() => {
		if (error && !(error instanceof NonFatalError)) throw error;
	}, [error]);

	const refetch: Refetch = useMemo(
		() => async () => {
			await mutate();
		},
		[mutate],
	);

	return useMemo<Resource<T>>(() => {
		if (error instanceof NonFatalError) return { status: "error", error, refetch };
		if (isLoading) return { status: "loading", refetch };
		if (data == null) return { status: "notFound", refetch };
		return { status: "ready", data, refetch };
	}, [data, isLoading, error, refetch]);
}

function callFetcher<T, Args extends unknown[]>([fetchItem, args]: readonly [
	Fetcher<T, Args>,
	Args,
]): T | undefined | Promise<T | undefined> {
	return fetchItem(...args);
}
