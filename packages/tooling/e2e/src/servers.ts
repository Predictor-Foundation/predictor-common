import type { PlaywrightTestConfig } from "@playwright/test";

type WebServerConfig = NonNullable<PlaywrightTestConfig["webServer"]>;
type WebServerEntry = WebServerConfig extends (infer T)[] ? T : WebServerConfig;

export interface ServerSpec {
	/** Shell command that starts the server. */
	command: string;
	/** URL Playwright polls until the server is ready. */
	url: string;
	/** Working directory for the command (relative to the config file). */
	cwd?: string;
	/** Extra environment for the spawned process. */
	env?: Record<string, string>;
	/** Readiness timeout in ms. Default 60s. */
	timeout?: number;
	/** Reuse an already-running server locally (never in CI). */
	reuseExistingServer?: boolean;
}

/**
 * Build a Playwright `webServer` entry with sane defaults. Pass one per process
 * (e.g. a backend and a frontend) in an array to `webServer`.
 */
export function server(spec: ServerSpec): WebServerEntry {
	return {
		command: spec.command,
		url: spec.url,
		cwd: spec.cwd,
		env: spec.env,
		timeout: spec.timeout ?? 60_000,
		reuseExistingServer: spec.reuseExistingServer ?? !process.env.CI,
		stdout: "pipe",
		stderr: "pipe",
	} as WebServerEntry;
}
