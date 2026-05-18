import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function resolveHuskyBin(): string {
	// husky@9 declares `"exports": "./index.js"`, which blocks
	// `require.resolve("husky/bin.js")`. package.json is always
	// resolvable though, so we read the `bin` field and join manually.
	const pkgPath = require.resolve("husky/package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
		bin?: string | Record<string, string>;
	};
	const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.husky;
	if (!binRel) throw new Error("husky package.json missing `bin` field");
	return join(dirname(pkgPath), binRel);
}

const HOOKS = ["pre-commit", "commit-msg"] as const;

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
	// We resolve the husky bin via package.json rather than PATH, because pnpm's
	// strict node_modules layout doesn't link transitive bins into the consumer's
	// `node_modules/.bin/` - `spawnSync("husky", ...)` would ENOENT under pnpm.
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
