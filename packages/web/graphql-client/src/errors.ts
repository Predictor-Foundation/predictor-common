import { CustomError } from "ts-custom-error";

/**
 * A single error object as returned in a GraphQL response's `errors` array.
 * The GraphQL spec guarantees `message`; everything else (path, locations,
 * extensions) is server-defined, so it is left open.
 */
export type GraphqlError = { message: string; [key: string]: unknown };

/**
 * Base class for failures a data-fetch layer can surface to the user without
 * crashing the application.
 *
 * The React layer treats any thrown value that is NOT a `NonFatalError` as a
 * programming/fatal error and rethrows it to the nearest error boundary; only
 * `NonFatalError` instances reach a `Resource`'s `error` state. Every error
 * this package throws extends `NonFatalError`.
 */
export class NonFatalError extends CustomError {}

/**
 * The endpoint returned an HTTP 200 whose body carried `errors` and no usable
 * `data`. Carries the full `errors` array so callers can inspect codes/paths;
 * the message is taken from the first error.
 */
export class DataError extends NonFatalError {
	constructor(
		message: string,
		public readonly errors: readonly GraphqlError[] = [],
	) {
		super(message);
	}
}

/**
 * The transport itself failed: `fetch()` rejected before any HTTP status was
 * seen (offline, DNS failure, CORS rejection, aborted request). Carries the
 * underlying rejection as `cause`.
 */
export class NetworkError extends NonFatalError {
	constructor(
		public readonly url: string,
		public readonly cause: unknown,
	) {
		super(`Cannot reach ${url}: ${describeCause(cause)}`);
	}
}

/** The endpoint responded with a non-OK HTTP status. */
export class FetchError extends NonFatalError {
	constructor(
		public readonly url: string,
		public readonly status: number,
		public readonly statusText?: string,
	) {
		super(`Cannot fetch ${url}: HTTP ${status}${statusText ? ` (${statusText})` : ""}`);
	}
}

function describeCause(cause: unknown): string {
	if (cause instanceof Error) return cause.message;
	return typeof cause === "string" ? cause : "unknown error";
}
