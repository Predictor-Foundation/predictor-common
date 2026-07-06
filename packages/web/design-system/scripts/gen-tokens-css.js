// Generate tokens.css (`:root` custom properties) from the canonical predictorTokens/fontFamilies in
// src/tokens.ts, so a plain-CSS consumer can reference `var(--pf-<token>)` instead of re-hardcoding
// the hex. Runs after tsc (reads the compiled lib/tokens.js), keeping the CSS from ever drifting from
// the TS source of truth.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fontFamilies, predictorTokens } from "../lib/tokens.js";

const toKebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const rows = [
	...Object.entries(predictorTokens).map(([name, value]) => `\t--pf-${toKebab(name)}: ${value};`),
	...Object.entries(fontFamilies).map(([name, value]) => `\t--pf-font-${toKebab(name)}: ${value};`),
];

const css = `${[
	"/* GENERATED from src/tokens.ts by scripts/gen-tokens-css.js - do not edit by hand. */",
	":root {",
	...rows,
	"}",
].join("\n")}\n`;

writeFileSync(fileURLToPath(new URL("../tokens.css", import.meta.url)), css);
