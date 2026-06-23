// Zero-setup Playwright harness for Predictor Foundation apps. The consumer's
// playwright.config.ts gets the config factory + server orchestration from here;
// specs use the standard `import { test, expect } from "@playwright/test"`.
//
// This package depends on @playwright/test for TYPES ONLY (erased at build), so
// importing it never loads a second Playwright runtime - which would trip
// Playwright's "two different versions" guard in linked/monorepo setups.
export { definePlaywrightConfig, type E2EConfigOptions } from "./config.js";
export { type ServerSpec, server } from "./servers.js";
