// PRDCTR design tokens, from the prdctr.io design-token extraction (PRDtokens.json):
// black surface stack (#000 / #151515 / #222 / #333), #e2effe ice-blue text,
// #939393-class gray ramp; Syne display / Inter body / DM Mono mono. The pale
// ice-blue #e3effd accent matches prdctr.io's current --primary (it replaced the
// earlier lime #d9fe42). Because it is near-identical to the foreground text, links
// carry an always-on underline (see theme.ts MuiLink) so they stay distinguishable.
export const predictorTokens = {
	foreground: "#e2effe",
	foregroundDisabled: "#7b7b7b",
	mutedForeground: "#939393",
	background: "#000000",
	card: "#151515",
	popover: "#222222",
	muted: "#222222",
	border: "#333333",
	primary: "#e3effd",
	primaryForeground: "#000000",
	link: "#e3effd",
	warning: "#f69e32",
	destructive: "#ec2127",
	success: "#52cc8a",
	secondaryHover: "#222222",
} as const;

export type PredictorTokens = typeof predictorTokens;

/** Font stacks used across the design system. */
export const fontFamilies = {
	display: '"Syne", -apple-system, BlinkMacSystemFont, sans-serif',
	body: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
	mono: '"DM Mono", monospace',
} as const;
