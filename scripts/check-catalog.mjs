// Enforce that every dependency the pnpm catalog owns is referenced as `catalog:` - never as a literal
// range - across all workspace packages. The catalog (in pnpm-workspace.yaml) is the single source of
// truth for those versions; a package that pins a literal range instead silently reintroduces the drift
// the catalog exists to prevent. Run in CI and pre-commit so a stray literal fails fast.
//
// Purpose-built (and dependency-free) rather than syncpack because the syncpack version our supply-chain
// cooldown allows does not yet understand the `catalog:` protocol and reports every catalog ref as an error.

import { globSync, readFileSync } from "node:fs";

/** Extract the dependency names listed under the top-level `catalog:` block of pnpm-workspace.yaml. */
function catalogNames(workspaceYaml) {
	const lines = workspaceYaml.split("\n");
	const start = lines.findIndex((l) => /^catalog:\s*$/.test(l));
	if (start === -1) return new Set();
	const names = new Set();
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) break; // dedent to column 0 ends the block
		if (/^\s*(#|$)/.test(line)) continue; // comment or blank
		const m = line.match(/^\s+(?:'([^']+)'|"([^"]+)"|([^:\s]+))\s*:/);
		if (m) names.add(m[1] ?? m[2] ?? m[3]);
	}
	return names;
}

const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const catalog = catalogNames(workspace);
if (catalog.size === 0) {
	console.error("check-catalog: no `catalog:` block found in pnpm-workspace.yaml");
	process.exit(1);
}

const violations = [];
for (const file of globSync("packages/*/*/package.json")) {
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(file, "utf8"));
	} catch (err) {
		console.error(`check-catalog: cannot parse ${file}: ${err.message}`);
		process.exit(1);
	}
	// peerDependencies intentionally declare broad compatibility ranges, so they are exempt.
	for (const field of ["dependencies", "devDependencies"]) {
		for (const [name, range] of Object.entries(pkg[field] ?? {})) {
			if (catalog.has(name) && range !== "catalog:") {
				violations.push(`${file} > ${field} > ${name}: "${range}" (must be "catalog:")`);
			}
		}
	}
}

if (violations.length > 0) {
	console.error(
		`check-catalog: ${violations.length} cataloged dependency(ies) not using catalog::`,
	);
	for (const v of violations) console.error(`  ${v}`);
	process.exit(1);
}
console.log(
	`check-catalog: OK - all ${catalog.size} cataloged deps referenced as catalog: across packages`,
);
