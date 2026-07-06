export type TruncateMiddleOptions = {
	/** Characters to keep at the start (a leading `0x` counts toward this). Default 6. */
	head?: number;
	/** Characters to keep at the end. Default 6. */
	tail?: number;
	/** Separator placed between the kept ends. Default `"…"` (horizontal ellipsis). */
	ellipsis?: string;
};

/**
 * Collapse the middle of a long string, keeping a prefix and suffix -
 * e.g. `0x1234…abcdef` for a hash or address.
 *
 * Pure. The string is only shortened when doing so actually makes it shorter
 * (i.e. when `value.length > head + tail + ellipsis.length`); otherwise the
 * value is returned unchanged. `undefined` in -> `undefined` out, so callers
 * can pass an optional value through without a wrapper.
 *
 * Unifies block-explorer's `shortenHash` and the bridge dapp's `shortAddress`.
 */
export function truncateMiddle(value: string, options?: TruncateMiddleOptions): string;
export function truncateMiddle(
	value: string | undefined,
	options?: TruncateMiddleOptions,
): string | undefined;
export function truncateMiddle(
	value: string | undefined,
	options: TruncateMiddleOptions = {},
): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const { head = 6, tail = 6, ellipsis = "…" } = options;

	if (value.length <= head + tail + ellipsis.length) {
		return value;
	}

	return `${value.slice(0, head)}${ellipsis}${value.slice(-tail)}`;
}
