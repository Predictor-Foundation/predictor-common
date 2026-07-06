/** Uppercase the first character, leaving the rest untouched. */
export function upperFirst(str: string): string {
	return `${str[0]?.toUpperCase() ?? ""}${str.slice(1)}`;
}

/** Lowercase the first character, leaving the rest untouched. */
export function lowerFirst(str: string): string {
	return `${str[0]?.toLowerCase() ?? ""}${str.slice(1)}`;
}

/** Strip whitespace, hyphens and underscores, then lowercase (casing-insensitive key). */
export function noCase(str: string): string {
	return str.replace(/[\s\-_]/g, "").toLowerCase();
}

/**
 * Parse a string to an integer, returning `undefined` for empty, missing,
 * non-numeric, or non-integer input (never `NaN`). A valid integer string such
 * as `"0"` or `"00"` returns its number.
 */
export function tryParseInt(str?: string): number | undefined {
	if (!str) {
		return undefined;
	}
	const n = +str;
	return Number.isInteger(n) ? n : undefined;
}
