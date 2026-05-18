#!/usr/bin/env node
import { install } from "./install";
import { run } from "./run";

const [, , subcommand, ...rest] = process.argv;

async function main(): Promise<number> {
	switch (subcommand) {
		case "install":
			return install();
		case "run": {
			const [step, ...args] = rest;
			if (!step) {
				process.stderr.write("usage: ivan-git-hooks run <pre-commit|commit-msg> [args]\n");
				return 2;
			}
			return run(step, args);
		}
		case "--help":
		case "-h":
		case undefined:
			process.stdout.write(
				[
					"ivan-git-hooks - opinionated git hooks for the Predictor Foundation",
					"",
					"usage:",
					"  ivan-git-hooks install            # set up .husky/* hooks in the current repo",
					"  ivan-git-hooks run <step> [args]  # run a hook step",
					"",
					"steps:",
					"  pre-commit              runs format -> lint -> typecheck -> audit, fast-failing on any failure",
					"  commit-msg <msg-file>   validates the commit subject against Conventional Commits",
					"",
				].join("\n"),
			);
			return 0;
		default:
			process.stderr.write(`unknown subcommand: ${subcommand}\n`);
			return 2;
	}
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		process.stderr.write(`ivan-git-hooks: ${err instanceof Error ? err.message : String(err)}\n`);
		process.exit(1);
	});
