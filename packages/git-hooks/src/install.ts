import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const HOOKS = ["pre-commit", "commit-msg"] as const;

/**
 * Locate husky's bin.js by walking the directory ancestors of this
 * file. We can't use `require.resolve("husky/bin.js")` or
 * `require.resolve("husky/package.json")` because husky 9 declares
 * `"exports": "./index.js"`, which blocks any other subpath.
 *
 * The bin always sits at husky's package root on disk. At each ancestor
 * we check two locations:
 *   1. `<dir>/node_modules/husky/bin.js`  — standard Node resolution
 *      (npm flat layout, also pnpm `node_modules/.bin` walks).
 *   2. `<dir>/husky/bin.js`               — pnpm's strict layout, where
 *      husky is a sibling of the importing package inside
 *      `.pnpm/<pkg>+<ver>/node_modules/husky/`. Our own package's
 *      `husky/` template dir doesn't contain `bin.js`, so no false hit.
 */
function resolveHuskyBin(): string {
	let dir = __dirname;
	while (true) {
		for (const candidate of [
			join(dir, "node_modules", "husky", "bin.js"),
			join(dir, "husky", "bin.js"),
		]) {
			if (existsSync(candidate)) return candidate;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error("husky bin not found in any ancestor directory");
}

/**
 * Set up husky + drop the opinionated hooks into the current repo's
 * `.husky/` directory.
 *
 * Idempotent: re-running overwrites the dropped hook files so version
 * bumps of this package propagate to consumers on their next
 * `pnpm install` (which re-runs the `prepare` script).
 *
 * Each hook script is a one-liner that delegates to
 * `ivan-git-hooks run <step>`. That indirection means the actual
 * hook *steps* can change across versions of this package without ever
 * editing the consumer's `.husky/` files.
 */
export function install(): number {
	const cwd = process.cwd();

	// Skip in CI - hooks aren't needed there, and `husky` no-ops in CI
	// anyway. Also skip if we're not inside a git repo (e.g. a freshly
	// extracted tarball during `npm publish`).
	if (process.env.CI === "true") {
		process.stdout.write("ivan-git-hooks: CI detected, skipping install\n");
		return 0;
	}
	if (!existsSync(join(cwd, ".git"))) {
		process.stdout.write("ivan-git-hooks: not a git repo, skipping install\n");
		return 0;
	}

	// Run husky to set up `.husky/` and wire `core.hooksPath`.
	const huskyBin = resolveHuskyBin();
	const husky = spawnSync(process.execPath, [huskyBin], { cwd, stdio: "inherit" });
	if (husky.status !== 0) {
		process.stderr.write(`ivan-git-hooks: husky failed to initialise (exit ${husky.status})\n`);
		return husky.status ?? 1;
	}

	// Copy the canonical hook templates into the consumer's .husky/.
	const huskyDir = join(cwd, ".husky");
	if (!existsSync(huskyDir)) mkdirSync(huskyDir, { recursive: true });

	const templateDir = resolve(__dirname, "..", "husky");
	for (const hook of HOOKS) {
		const src = join(templateDir, hook);
		const dst = join(huskyDir, hook);
		copyFileSync(src, dst);
		chmodSync(dst, 0o755);
	}

	process.stdout.write(`ivan-git-hooks: installed ${HOOKS.map((h) => `.husky/${h}`).join(", ")}\n`);
	return 0;
}
