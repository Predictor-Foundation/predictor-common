import { BigDecimal } from "@subsquid/big-decimal";

/**
 * Precision-preserving arithmetic on Postgres `numeric` values.
 *
 * Postgres `numeric` aggregates flow through the server-extension as
 * arbitrary-precision JS strings. `parseFloat`/`Number()` on them silently
 * lose precision beyond ~15 significant figures and corrupt aggregates by
 * sub-cent amounts on large sums. These helpers route every operation through
 * BigDecimal so the precision invariant the resolver surface advertises
 * (string-typed numeric fields) actually holds end to end.
 *
 * Convention: "null in / null out for absence, string otherwise". Callers
 * decide whether absence means zero or "no data", so nothing is coalesced
 * silently - `sumStrings` and `NumericAccumulator.toStringOrNull` codify the
 * "no data at all -> null" branch resolvers actually want.
 *
 * Lifted from prediction-markets/src/server-extension/services/numericString.ts.
 */

const ZERO = BigDecimal("0");

/** Sum nullable numeric strings; returns null only when every input is null. */
export function sumStrings(values: ReadonlyArray<string | null | undefined>): string | null {
	let hasValue = false;
	let acc = ZERO;
	for (const v of values) {
		if (v != null) {
			acc = acc.add(v);
			hasValue = true;
		}
	}
	return hasValue ? acc.toString() : null;
}

/** `a + b` for numeric strings, precision-preserving. */
export function addStrings(a: string, b: string): string {
	return BigDecimal(a).add(b).toString();
}

/** `a - b` for numeric strings, precision-preserving. */
export function subStrings(a: string, b: string): string {
	return BigDecimal(a).sub(b).toString();
}

/** `a / b` for numeric strings. Caller must ensure `b !== "0"`. */
export function divStrings(a: string, b: string): string {
	return BigDecimal(a).div(b).toString();
}

/** Precise `value > 0` predicate, safe for arbitrary-precision numerics. */
export function gtZero(value: string): boolean {
	return BigDecimal(value).gt(ZERO);
}

/**
 * Mutable BigDecimal-backed accumulator. `add(null)` is a no-op (an absent
 * contribution is not the same as a zero contribution); `toStringOrNull`
 * returns null when no non-null value was ever added, else the running sum.
 */
export class NumericAccumulator {
	private value = ZERO;
	private hasData = false;

	add(s: string | null | undefined): this {
		if (s != null) {
			this.value = this.value.add(s);
			this.hasData = true;
		}
		return this;
	}

	toString(): string {
		return this.value.toString();
	}

	toStringOrNull(): string | null {
		return this.hasData ? this.value.toString() : null;
	}
}
