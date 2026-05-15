/**
 * JSON replacer that serialises bigint values as their decimal string form.
 * `JSON.stringify` throws on bigint by default; this preserves precision
 * without depending on `toJSON` being installed on BigInt.prototype.
 */
export const bigintReplacer = (_: string, v: unknown): unknown =>
	typeof v === "bigint" ? v.toString() : v;

/** `JSON.stringify` that tolerates bigint values (converted to decimal strings). */
export function serializeJson(value: unknown): string {
	return JSON.stringify(value, bigintReplacer);
}

/**
 * Outcome of `truncateJsonPayload`. The previous block-explorer
 * implementation conflated "too large" and "non-serialisable" into a
 * single `null`; this tagged union forces the caller to handle the
 * cases explicitly.
 */
export type TruncatedJson =
	| { kind: "ok"; value: unknown }
	| { kind: "too-large"; byteBudget: number }
	| { kind: "non-serializable" };

/**
 * Cap a JSON-serialisable payload at a byte budget without ever
 * materialising the full string.
 *
 * Uses `JSON.stringify`'s replacer hook to accumulate a length estimate
 * (string length for string values; a pessimistic `+10` for other
 * primitives - bigger than the actual decimal/boolean representation,
 * so the cap kicks in conservatively). Returns:
 *   - `{ kind: "ok", value }` when the payload fits.
 *   - `{ kind: "too-large", byteBudget }` when accumulated bytes exceed
 *     the budget.
 *   - `{ kind: "non-serializable" }` when the payload contains circular
 *     references or other non-serialisable structures.
 *
 * Primitives (number / string / boolean / null / undefined) are
 * short-circuited - they're cheap and never circular.
 */
export function truncateJsonPayload(value: unknown, byteBudget: number): TruncatedJson {
	if (value == null || (typeof value !== "object" && !Array.isArray(value))) {
		return { kind: "ok", value };
	}

	let accumulated = 0;
	let overLimit = false;
	try {
		JSON.stringify(value, (_key, v) => {
			if (overLimit) return undefined;
			accumulated += typeof v === "string" ? v.length : 10;
			if (accumulated > byteBudget) {
				overLimit = true;
				return undefined;
			}
			return v;
		});
	} catch {
		return { kind: "non-serializable" };
	}
	return overLimit ? { kind: "too-large", byteBudget } : { kind: "ok", value };
}
