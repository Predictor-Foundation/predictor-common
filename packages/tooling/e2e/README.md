# @predictor-foundation/e2e

Zero-setup Playwright harness. A consumer repo gets Predictor's E2E defaults
(reporters, retries, traces, browser projects, server orchestration) and the
Playwright test API from a single import - no boilerplate.

## Install

```bash
GITHUB_TOKEN=$(gh auth token) pnpm add -D @predictor-foundation/e2e @playwright/test
pnpm exec playwright install chromium
```

## Use

`playwright.config.ts`:

```ts
import { definePlaywrightConfig, server } from "@predictor-foundation/e2e";

export default definePlaywrightConfig({
	baseURL: "http://localhost:3000",
	webServer: [
		server({
			command: "node --experimental-strip-types src/index.ts",
			cwd: "packages/backend",
			url: "http://localhost:8080/healthz",
			env: { PORT: "8080" },
		}),
		server({
			command: "pnpm --filter @app/frontend start",
			url: "http://localhost:3000",
		}),
	],
});
```

`e2e/app.spec.ts` (specs use the standard Playwright import):

```ts
import { test, expect } from "@playwright/test";

test("loads", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle(/My App/);
});
```

That's it - `playwright test` starts the servers, waits for readiness, runs the specs.

## Exports

- `definePlaywrightConfig(opts)` - the config factory (CI-aware: retries, GitHub + HTML reporters, traces on retry).
- `server(spec)` - build a `webServer` entry with sane defaults (60s readiness, reuse-locally).

This package depends on `@playwright/test` for **types only** (erased at build), so importing
it never loads a second Playwright runtime - avoiding the "two different versions of
@playwright/test" error in linked/monorepo setups. Import `test`/`expect` from
`@playwright/test` directly in your specs.
