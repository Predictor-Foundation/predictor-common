import Decimal from "decimal.js";

const supportedFiatCurrencies = ["USD"];

export type FormatNumberOptions = {
	decimalPlaces?: number;
	compact?: boolean;
};

export function formatNumber(value: number | Decimal, options: FormatNumberOptions = {}) {
	const decimal = value instanceof Decimal ? value : new Decimal(value);

	return Intl.NumberFormat("en-US", {
		maximumFractionDigits: options.compact ? 3 : options.decimalPlaces || 20,
		notation: options.compact ? "compact" : undefined,
	}).format(decimal.toString() as unknown as number);
}

export type FormatCurrencyOptions = {
	decimalPlaces?: "optimal" | number;
	minimalUsdValue?: Decimal;
	usdRate?: Decimal;
	compact?: boolean;
};

export function formatCurrency(
	value: number | Decimal,
	currency: string,
	options: FormatCurrencyOptions = {},
) {
	const decimal = value instanceof Decimal ? value : new Decimal(value);

	let decimalPlaces = options.decimalPlaces || 20;

	if (decimalPlaces === "optimal") {
		decimalPlaces = options.usdRate
			? getOptimalDecimalPlaces(options.usdRate, options.minimalUsdValue)
			: currency.toUpperCase() === "USD"
				? 2 // default for USD
				: 4; // default for crypto
	}

	// Intl formats fiat currencies using proper symbols like $
	if (supportedFiatCurrencies.includes(currency.toUpperCase())) {
		return Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			maximumFractionDigits: options.compact ? 3 : decimalPlaces,
			notation: options.compact ? "compact" : undefined,
		}).format(decimal.toString() as unknown as number);
	}

	// cryptocurrencies are formatted simply using the code (e.g. PRD)
	return `${formatNumber(decimal, { decimalPlaces, compact: options.compact })} ${currency}`;
}

/**
 * Optimal decimal places for a cryptocurrency so the minimal USD value is still
 * representable after rounding.
 */
export function getOptimalDecimalPlaces(usdRate: Decimal, minimalUsdValue = new Decimal("0.01")) {
	const cryptoValueOfMinimalUsdValue = minimalUsdValue.div(usdRate);
	return cryptoValueOfMinimalUsdValue.log().neg().ceil().toNumber();
}
