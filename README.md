# predictor-common

Shared TypeScript/Subsquid platform packages for the Predictor Foundation.
Any TypeScript project - Subsquid or not - can pull in the dev-tooling
bundle in three lines and inherit the family's conventions for free.

## Packages

Packages live under `packages/<group>/<package>`, grouped by the layer they
serve. Consumers install by package name (`@predictor-foundation/<name>`); the
folder grouping is for humans, not resolution.

### `tooling/` - shared build, lint & test setup (dev dependencies)

| Package | Purpose |
|---|---|
| [`tsconfig`](packages/tooling/tsconfig) | Shared `tsconfig` presets (`base`, `node`, `subsquid`, `react`) |
| [`biome-config`](packages/tooling/biome-config) | Shared Biome lint + format config with the Biome version pinned |
| [`git-hooks`](packages/tooling/git-hooks) | Husky-based pre-commit gate: format → lint → typecheck → audit |
| [`e2e`](packages/tooling/e2e) | Zero-setup Playwright harness: config factory + server orchestration |

### `chain/` - Substrate / polkadot-api client (runtime)

| Package | Purpose |
|---|---|
| [`substrate-primitives`](packages/chain/substrate-primitives) | Branded, validated SS58 address + non-negative Planck balance |
| [`substrate-signer`](packages/chain/substrate-signer) | sr25519 key derivation (`parseSuri`/`deriveKeypair`) + address helpers |
| [`scale`](packages/chain/scale) | Minimal, dependency-free SCALE codec helpers |
| [`chain-errors`](packages/chain/chain-errors) | Chain-boundary error taxonomy + retry/backoff |
| [`papi-chain`](packages/chain/papi-chain) | Descriptor-generic polkadot-api chain boundary (connect / read / submit) |
| [`node-manager`](packages/chain/node-manager) | Client-side contracts for the node-manager pallet (heartbeat payload) |
| [`network-constants`](packages/chain/network-constants) | Single source of truth for network coordinates (prefix, decimals, symbol, endpoints) |

### `indexer/` - Subsquid

| Package | Purpose |
|---|---|
| [`squid-common`](packages/indexer/squid-common) | Env parsing, SS58 codec, account upsert, entity cache, processor builder, id families, branded primitives |

### `service/` - long-lived Node services (daemons, HTTP APIs)

| Package | Purpose |
|---|---|
| [`logger`](packages/service/logger) | Tiny dependency-free structured JSON-lines logger |
| [`env`](packages/service/env) | Zod-based environment parsing primitives (fail-fast) |
| [`service-runtime`](packages/service/service-runtime) | Health state machine, k8s probe routes, tick loop, graceful shutdown |

### `web/` - frontend

| Package | Purpose |
|---|---|
| [`design-system`](packages/web/design-system) | Shared PRDCTR Material-UI theme + design tokens |
| [`ui`](packages/web/ui) | App-agnostic React components + pure utils (address/amount/date/string), per-component subpath imports |
| [`graphql-client`](packages/web/graphql-client) | Framework-light GraphQL-over-HTTP client + React data hooks (`/react` subpath) |

## Quick start (consumer repo)

```bash
# 1. Add .npmrc at repo root (copy from .npmrc.example here)
cat > .npmrc <<'EOF'
@predictor-foundation:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF

# 2. Install the dev bundle
pnpm add -D \
  @predictor-foundation/tsconfig \
  @predictor-foundation/biome-config \
  @predictor-foundation/git-hooks \
  typescript
```

Then drop in three small config files:

```json
// package.json (relevant fields)
{
  "scripts": {
    "lint": "biome check .",
    "prepare": "predictor-git-hooks install"
  }
}
```

```json
// tsconfig.json
{ "extends": "@predictor-foundation/tsconfig/node" }
```

```json
// biome.json
{ "extends": ["@predictor-foundation/biome-config/base"] }
```

Subsquid repos extend `@predictor-foundation/tsconfig/subsquid` and
`@predictor-foundation/biome-config/subsquid` instead, and add
`@predictor-foundation/squid-common` as a runtime dep.

## Repo conventions

- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/).
  Scope is the affected package (e.g. `fix(tsconfig):`, `feat(squid-common):`).
- **Releases:** [release-please](https://github.com/googleapis/release-please)
  in manifest mode. Each PR's conventional-commit scope drives which
  package(s) bump on the next release.
- **Lint/format:** Biome, dogfood-extending `@predictor-foundation/biome-config/base`.
- **TypeScript:** dogfood-extending `@predictor-foundation/tsconfig/base`.
- **Dependency versions:** shared third-party versions (`typescript`, `@types/node`,
  `polkadot-api`, `@polkadot-*`, `zod`) live in the `catalog:` block of
  `pnpm-workspace.yaml`. Every package references `catalog:` instead of a literal
  range, so a version can never drift between packages. `scripts/check-catalog.mjs`
  (run as `pnpm lint:catalog`) fails if any cataloged dep uses a literal range.
- **Supply-chain cooldown:** a third-party version must be public for 24h
  (`minimumReleaseAge`) before it can install, and no dependency may run install
  lifecycle scripts unless listed in `onlyBuiltDependencies` (empty by default).
  Our own `@predictor-foundation/*` scope is excluded from the cooldown. Requires
  pnpm 10 (pinned via `packageManager`).

## Development

```bash
pnpm install
pnpm -r build
pnpm -r run typecheck   # also `pnpm -r run types:check`
pnpm -r run test        # unit tests run TypeScript directly (Node >= 22.6)
pnpm lint
pnpm lint:catalog       # catalog-consistency check
```

CI runs the same build → typecheck → test → lint → catalog steps on Node 24.
Published libraries still target `node >=20` (they ship compiled JS).
