import { DataError, FetchError, type GraphqlError, NetworkError } from "./errors";
import { assembleDocument, FragmentRegistry } from "./fragments";

/**
 * A source of fragment definitions to resolve against a query: either a
 * `FragmentRegistry` or a plain map of `name -> full fragment definition`.
 */
export type FragmentSource = FragmentRegistry | Record<string, string>;

/** A single GraphQL request. One options object, so no argument-order mistakes. */
export interface GraphqlRequest {
	/** Absolute URL of the GraphQL endpoint. */
	url: string;
	/** The GraphQL document to execute. */
	query: string;
	/** Variables for the document. Defaults to `{}`. */
	variables?: Record<string, unknown>;
	/** Fragments to resolve against `query` and append to the request body. */
	fragments?: FragmentSource;
	/** Extra headers, merged over the default `Content-Type: application/json`. */
	headers?: Record<string, string>;
	/** Abort signal for cancellation. */
	signal?: AbortSignal;
}

type GraphqlEnvelope<T> = { data?: T | null; errors?: GraphqlError[] };

/**
 * Execute a GraphQL query over HTTP POST and return its `data` payload.
 *
 * `T` is the shape of the `data` object; this function is generic over it and
 * performs no domain-level parsing - validate the payload at the call site.
 *
 * Failure postconditions (each extends `NonFatalError`):
 *  - transport rejection (offline, DNS, CORS, abort) -> `NetworkError`
 *  - non-OK HTTP status                              -> `FetchError`
 *  - body has `errors` and no `data`                 -> `DataError`
 */
export async function fetchGraphql<T>(request: GraphqlRequest): Promise<T> {
	const { url, query, variables = {}, fragments, headers, signal } = request;

	const document = resolveDocument(query, fragments);

	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...headers },
			body: JSON.stringify({ query: document, variables }),
			signal,
		});
	} catch (cause) {
		throw new NetworkError(url, cause);
	}

	if (!response.ok) {
		throw new FetchError(url, response.status, response.statusText || undefined);
	}

	const envelope = (await response.json()) as GraphqlEnvelope<T>;

	if (envelope.data == null) {
		const errors = envelope.errors ?? [];
		throw new DataError(errors[0]?.message ?? "GraphQL request returned no data", errors);
	}

	return envelope.data;
}

function resolveDocument(query: string, fragments?: FragmentSource): string {
	if (fragments === undefined) return query;
	if (fragments instanceof FragmentRegistry) return fragments.resolve(query);
	return assembleDocument(query, (name) => fragments[name]);
}
