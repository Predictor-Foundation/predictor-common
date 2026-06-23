# predictor-common

Shared TypeScript/Subsquid platform packages for the Predictor Foundation.
Any TypeScript project - Subsquid or not - can pull in the dev-tooling
bundle in three lines and inherit the family's conventions for free.

## Packages

| Package | Audience | Purpose |
|---|---|---|
| [`@predictor-foundation/tsconfig`](packages/tsconfig) | any TS repo | Shared `tsconfig` presets (`base`, `node`, `subsquid`, `react`) |
| [`@predictor-foundation/biome-config`](packages/biome-config) | any TS repo | Shared Biome lint + format config with Biome version pinned |
| [`@predictor-foundation/git-hooks`](packages/git-hooks) | any repo | Husky-based pre-commit gate: format → lint → typecheck → audit |
| [`@predictor-foundation/squid-common`](packages/squid-common) | Subsquid squids | Env parsing, SS58 codec, account upsert, entity cache, processor builder, branded primitives |
| [`@predictor-foundation/design-system`](packages/design-system) | Frontends | Shared PRDCTR Material-UI theme + design tokens (colours, fonts) |
| [`@predictor-foundation/ui`](packages/ui) | Frontends | App-agnostic React components (icons, cards, links, currency/time), with per-component subpath imports |
| [`@predictor-foundation/e2e`](packages/e2e) | Playwright repos | Zero-setup Playwright harness: config factory + server orchestration |

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

## Development

```bash
pnpm install
pnpm -r build
pnpm lint
```
