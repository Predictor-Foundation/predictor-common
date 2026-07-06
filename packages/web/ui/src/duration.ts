const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

/**
 * Format a duration in milliseconds as a coarse human-readable span, e.g.
 * `"24 hours"` or `"5 minutes"`. Rounds to whole hours when the span is at least
 * an hour, otherwise to whole minutes (never below one minute). Suitable for
 * cooldown / wait-time copy.
 */
export function formatDuration(ms: number): string {
	const hours = Math.round(ms / MS_PER_HOUR);
	if (hours >= 1) {
		return `${hours} hour${hours === 1 ? "" : "s"}`;
	}
	const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
	return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
