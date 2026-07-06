import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Step = "pre-commit" | "commit-msg";

/**
 * Dispatch a hook step. Consumer's `.husky/<hook>` calls
 * `predictor-git-hooks run <step> [args]`; the steps that run *inside*
 * that dispatch are owned here. Changing the steps is a release of
 * this package, not a per-repo `.husky/` edit.
 *
 * Steps:
 *
 *   - pre-commit  runs format -> lint -> typecheck -> audit, fast-failing
 *                 on the first non-zero exit.
 *   - commit-msg  validates the commit message file (passed as $1 by
 *                 husky) against a Conventional Commits shape check.
 *                 Shape only - scope values are not enforced here; the
 *                 server-side PR-title lint is the source of truth for
 *                 which scopes are allowed.
 */
export function run(step: string, args: string[]): number {
	switch (step as Step) {
		case "pre-commit":
			return runPreCommit();
		case "commit-msg":
			return runCommitMsg(args[0]);
		default:
			process.stderr.write(`predictor-git-hooks: unknown step "${step}"\n`);
			return 2;
	}
}

function runPreCommit(): number {
	const steps: Array<{ name: string; cmd: string; args: string[] }> = [
		{ name: "format", cmd: "pnpm", args: ["exec", "biome", "format", "--write", "."] },
		{ name: "lint", cmd: "pnpm", args: ["exec", "biome", "check", "."] },
		{ name: "typecheck", cmd: "pnpm", args: ["-r", "exec", "tsc", "--noEmit"] },
		{ name: "audit", cmd: "pnpm", args: ["audit", "--prod", "--audit-level=high"] },
	];

	for (const { name, cmd, args } of steps) {
		process.stdout.write(`\n[predictor-git-hooks] ${name}\n`);
		const result = spawnSync(cmd, args, { stdio: "inherit" });
		if (result.status !== 0) {
			process.stderr.write(`\n[predictor-git-hooks] ${name} failed - commit aborted\n`);
			return result.status ?? 1;
		}
		// After the format step, re-stage files Biome may have rewritten
		// so the commit sees the fixed content rather than the pre-format
		// version.
		if (name === "format") {
			const restage = spawnSync("git", ["update-index", "--again"], { stdio: "inherit" });
			if (restage.status !== 0) {
				process.stderr.write("[predictor-git-hooks] re-stage after format failed\n");
				return restage.status ?? 1;
			}
		}
	}
	return 0;
}

// Conventional Commits shape:
//   <type>[(scope)][!]: <subject>
// type: one of the recognised verbs (superset of release-please's known
// types, so consumers can use any of them without surprise).
// scope: optional, any non-empty token without whitespace or ')'.
// !: optional breaking-change marker.
// subject: must start with a lowercase letter and not end with '.', to
// match the server-side subjectPattern in pr-title.yml.
const CONVENTIONAL_TYPES = [
	"feat",
	"fix",
	"refactor",
	"perf",
	"deps",
	"docs",
	"chore",
	"test",
	"build",
	"ci",
	"style",
	"revert",
] as const;
const CONVENTIONAL_RE = new RegExp(
	`^(${CONVENTIONAL_TYPES.join("|")})(\\([^)\\s]+\\))?!?: [a-z].+[^.]$`,
);

// Subjects git generates itself (merges, reverts, fixups, squashes,
// WIP) skip the check - they're either rewritten on squash-merge or
// reflect git plumbing, not user intent.
const PASSTHROUGH_PREFIXES = ["Merge ", "Revert ", "fixup!", "squash!", "amend!"];

function runCommitMsg(msgFile: string | undefined): number {
	if (!msgFile) {
		process.stderr.write("predictor-git-hooks: commit-msg step requires a message file path\n");
		return 2;
	}

	let raw: string;
	try {
		raw = readFileSync(msgFile, "utf8");
	} catch (err) {
		process.stderr.write(
			`predictor-git-hooks: cannot read commit message file "${msgFile}": ${
				err instanceof Error ? err.message : String(err)
			}\n`,
		);
		return 1;
	}

	// First non-comment, non-empty line is the subject.
	const subject = raw.split("\n").find((line) => line.trim().length > 0 && !line.startsWith("#"));

	if (!subject) {
		process.stderr.write("[predictor-git-hooks] commit-msg: empty message - commit aborted\n");
		return 1;
	}

	if (PASSTHROUGH_PREFIXES.some((p) => subject.startsWith(p))) {
		return 0;
	}

	if (!CONVENTIONAL_RE.test(subject)) {
		process.stderr.write(
			[
				"",
				"[predictor-git-hooks] commit-msg: subject does not match Conventional Commits",
				`  got:      ${subject}`,
				`  expected: <type>[(scope)][!]: <subject>`,
				`  types:    ${CONVENTIONAL_TYPES.join(", ")}`,
				"  subject:  must start with a lowercase letter and not end with '.'",
				"  example:  feat(squid-common): add SS58 encoder",
				"",
				"commit aborted",
				"",
			].join("\n"),
		);
		return 1;
	}

	return 0;
}
