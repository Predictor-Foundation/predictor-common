import type { PlaywrightTestConfig } from "@playwright/test";

export interface E2EConfigOptions {
	/** Directory holding the *.spec.ts files. Default "e2e". */
	testDir?: string;
	/** App URL the tests hit. Default "http://localhost:3000". */
	baseURL?: string;
	/** Servers Playwright starts + waits on before the run (see `server()`). */
	webServer?: PlaywrightTestConfig["webServer"];
	/** Escape hatch - merged last over the computed config. */
	overrides?: Partial<PlaywrightTestConfig>;
}

const isCI = Boolean(process.env.CI);

/**
 * Opinionated Playwright config with Predictor defaults baked in, so a consumer
 * repo needs only:
 *
 *   import { definePlaywrightConfig, server } from "@predictor-foundation/e2e";
 *   export default definePlaywrightConfig({ webServer: [server({...})] });
 */
export function definePlaywrightConfig(opts: E2EConfigOptions = {}): PlaywrightTestConfig {
	return {
		testDir: opts.testDir ?? "e2e",
		fullyParallel: true,
		forbidOnly: isCI,
		retries: isCI ? 2 : 0,
		workers: isCI ? 1 : undefined,
		reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
		timeout: 30_000,
		expect: { timeout: 10_000 },
		use: {
			baseURL: opts.baseURL ?? "http://localhost:3000",
			trace: "on-first-retry",
			screenshot: "only-on-failure",
		},
		projects: [
			{
				name: "chromium",
				use: { browserName: "chromium", viewport: { width: 1280, height: 720 } },
			},
		],
		webServer: opts.webServer,
		...opts.overrides,
	};
}
