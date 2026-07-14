// Enforce that every dependency the pnpm catalog owns is referenced as `catalog:` - never as a literal
// range - across all workspace packages. The catalog (in pnpm-workspace.yaml) is the single source of
// truth for those versions; a package that pins a literal range instead silently reintroduces the drift
// the catalog exists to prevent. Run in CI and pre-commit so a stray literal fails fast.
//
// Purpose-built (and dependency-free) rather than syncpack because the syncpack version our supply-chain
// cooldown allows does not yet understand the `catalog:` protocol and reports every catalog ref as an error.

import { existsSync, readdirSync, readFileSync } from "node:fs";

// Find every package.json in the two-level `packages/<group>/<name>` layout the workspace uses,
// using only `readdirSync` so the script runs on the repo's Node floor (>=20). `fs.globSync` is
// Node >=22 only and would throw `globSync is not a function` in pre-commit/CI on Node 20/21.
function packageManifests() {
	const packagesRoot = new URL("../packages/", import.meta.url);
	const manifests = [];
	for (const group of readdirSync(packagesRoot, { withFileTypes: true })) {
		if (!group.isDirectory()) continue;
		const groupDir = new URL(`${group.name}/`, packagesRoot);
		for (const pkg of readdirSync(groupDir, { withFileTypes: true })) {
			if (!pkg.isDirectory()) continue;
			const url = new URL(`${pkg.name}/package.json`, groupDir);
			if (existsSync(url)) {
				manifests.push({ url, display: `packages/${group.name}/${pkg.name}/package.json` });
			}
		}
	}
	return manifests;
}

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
for (const { url, display } of packageManifests()) {
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(url, "utf8"));
	} catch (err) {
		console.error(`check-catalog: cannot parse ${display}: ${err.message}`);
		process.exit(1);
	}
	// peerDependencies intentionally declare broad compatibility ranges, so they are exempt.
	for (const field of ["dependencies", "devDependencies"]) {
		for (const [name, range] of Object.entries(pkg[field] ?? {})) {
			if (catalog.has(name) && range !== "catalog:") {
				violations.push(`${display} > ${field} > ${name}: "${range}" (must be "catalog:")`);
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
