/**
 * Domain error hierarchy for the server-extension layer.
 *
 * Resolvers throw these so the GraphQL layer surfaces a structured `code` +
 * `message`; the type-graphql runtime catches the throw and reports it as a
 * GraphQL error.
 *
 * The `ErrorCode` enum is exported plain - each squid registers it with
 * type-graphql in its own `server-extension/errors.ts` (calling
 * `registerEnumType(ErrorCode, { name: "<SquidName>ErrorCode" })`). That
 * keeps GraphQL schema concerns out of squid-common (which has no
 * `type-graphql` dependency).
 */
export enum ErrorCode {
	DATABASE_ERROR = "DATABASE_ERROR",
	INVALID_INPUT = "INVALID_INPUT",
	NOT_FOUND = "NOT_FOUND",
}

export class BaseError extends Error {
	constructor(
		message: string,
		public readonly code: ErrorCode,
	) {
		super(message);
		this.name = this.constructor.name;
		// `Error.captureStackTrace` is V8-only; type as the loose runtime
		// signature so squid-common's `tsc` doesn't require @types/node for a
		// browser-safe fallback.
		const capture = (Error as unknown as { captureStackTrace?: (t: object, c: object) => void })
			.captureStackTrace;
		capture?.(this, this.constructor);
	}
}

export class DatabaseError extends BaseError {
	constructor(message: string) {
		super(message, ErrorCode.DATABASE_ERROR);
	}
}

export class InvalidInputError extends BaseError {
	constructor(message: string) {
		super(message, ErrorCode.INVALID_INPUT);
	}
}

export class NotFoundError extends BaseError {
	constructor(message: string) {
		super(message, ErrorCode.NOT_FOUND);
	}
}
