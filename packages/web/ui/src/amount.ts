/**
 * Token amount conversion between human decimal strings and integer base units
 * (e.g. planck). Pure `bigint` arithmetic - no `ethers`/`Decimal` dependency.
 * The token's `decimals` is always an explicit parameter, never a hardcoded
 * default, so these helpers make no assumption about any single token's scale.
 */

/** Largest value representable in the Predictor chain's `u128` amount field. */
export const MAX_U128 = (1n << 128n) - 1n;

/** Why a human amount string could not be parsed into base units. */
export type ParseTokenAmountError =
	| { kind: "empty" }
	| { kind: "not-a-number" }
	| { kind: "not-positive" }
	| { kind: "invalid-decimals"; decimals: number }
	| { kind: "too-many-fractional-digits"; decimals: number }
	| { kind: "exceeds-max"; max: bigint };

/** Result of {@link parseTokenAmount}: a validated base-unit amount, or a typed error. */
export type ParseTokenAmountResult =
	| { ok: true; value: bigint }
	| { ok: false; error: ParseTokenAmountError };

export type ParseTokenAmountOptions = {
	/** Number of base-unit decimal places for the token (0-255). */
	decimals: number;
	/** Upper bound for the parsed value. Defaults to {@link MAX_U128}. */
	max?: bigint;
};

/**
 * Parse a human decimal string (e.g. `"1.5"`) into integer base units.
 *
 * Parse, don't validate: returns a discriminated {@link ParseTokenAmountResult}
 * rather than throwing, so every failure mode is a typed value the caller must
 * handle. The amount must be a strictly positive decimal that fits within `max`
 * and carries no more fractional digits than `decimals`.
 */
export function parseTokenAmount(
	input: string,
	options: ParseTokenAmountOptions,
): ParseTokenAmountResult {
	const { decimals, max = MAX_U128 } = options;

	if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
		return { ok: false, error: { kind: "invalid-decimals", decimals } };
	}

	const trimmed = input.trim();
	if (trimmed === "") {
		return { ok: false, error: { kind: "empty" } };
	}

	const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
	if (!match) {
		return { ok: false, error: { kind: "not-a-number" } };
	}

	const wholePart = match[1];
	const fracPart = match[2] ?? "";
	if (fracPart.length > decimals) {
		return { ok: false, error: { kind: "too-many-fractional-digits", decimals } };
	}

	const base = 10n ** BigInt(decimals);
	const fraction = fracPart === "" ? 0n : BigInt(fracPart.padEnd(decimals, "0"));
	const value = BigInt(wholePart) * base + fraction;

	if (value <= 0n) {
		return { ok: false, error: { kind: "not-positive" } };
	}
	if (value > max) {
		return { ok: false, error: { kind: "exceeds-max", max } };
	}

	return { ok: true, value };
}

/** Human-readable default message for a {@link ParseTokenAmountError}. */
export function parseTokenAmountErrorMessage(error: ParseTokenAmountError): string {
	switch (error.kind) {
		case "empty":
			return "Enter an amount.";
		case "not-a-number":
			return "Enter a valid number.";
		case "not-positive":
			return "Enter an amount greater than zero.";
		case "invalid-decimals":
			return "Token decimals must be a whole number between 0 and 255.";
		case "too-many-fractional-digits":
			return `Enter at most ${error.decimals} decimal places.`;
		case "exceeds-max":
			return "Amount is too large.";
	}
}

export type FormatTokenAmountOptions = {
	/** Number of base-unit decimal places for the token. */
	decimals: number;
	/** Optional token symbol appended after a space, e.g. `"PRD"`. */
	symbol?: string;
};

/**
 * Format an integer base-unit amount as a human decimal string with thousands
 * separators on the integer part. Trailing fractional zeros are trimmed; an
 * exact whole number renders with no fractional part. Pass `symbol` to append a
 * unit (e.g. `"1,234.5 PRD"`).
 *
 * Unifies the bridge dapp's `formatTokenAmount` and the faucet's `formatAmount`.
 */
export function formatTokenAmount(
	value: bigint | string,
	options: FormatTokenAmountOptions,
): string {
	const { decimals, symbol } = options;
	const raw = typeof value === "bigint" ? value : BigInt(value);
	const negative = raw < 0n;
	const abs = negative ? -raw : raw;

	const base = 10n ** BigInt(decimals);
	const whole = abs / base;
	const fraction = abs % base;

	const groupedWhole = addThousandsSeparators(whole.toString());
	const fractionStr =
		decimals > 0 ? fraction.toString().padStart(decimals, "0").replace(/0+$/, "") : "";

	const sign = negative ? "-" : "";
	const number = fractionStr ? `${sign}${groupedWhole}.${fractionStr}` : `${sign}${groupedWhole}`;

	return symbol ? `${number} ${symbol}` : number;
}

/** Insert `,` every three digits of a non-negative integer string. */
function addThousandsSeparators(integerDigits: string): string {
	return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
