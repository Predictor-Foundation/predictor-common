# predictor-common

Shared TypeScript/Subsquid platform packages for the Predictor Foundation.
Any TypeScript project - Subsquid or not - can pull in the dev-tooling
bundle in three lines and inherit the family's conventions for free.

## Packages

| Package | Audience | Purpose |
|---|---|---|
| [`@ivan-cholakov/tsconfig`](packages/tsconfig) | any TS repo | Shared `tsconfig` presets (`base`, `node`, `subsquid`, `react`) |
| [`@ivan-cholakov/biome-config`](packages/biome-config) | any TS repo | Shared Biome lint + format config with Biome version pinned |
| [`@ivan-cholakov/git-hooks`](packages/git-hooks) | any repo | Husky-based pre-commit gate: format → lint → typecheck → audit |
| [`@ivan-cholakov/squid-common`](packages/squid-common) | Subsquid squids | Env parsing, SS58 codec, account upsert, entity cache, processor builder, branded primitives |

## Quick start (consumer repo)

```bash
# 1. Add .npmrc at repo root (copy from .npmrc.example here)
cat > .npmrc <<'EOF'
@ivan-cholakov:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF

# 2. Install the dev bundle
pnpm add -D \
  @ivan-cholakov/tsconfig \
  @ivan-cholakov/biome-config \
  @ivan-cholakov/git-hooks \
  typescript
```

Then drop in three small config files:

```json
// package.json (relevant fields)
{
  "scripts": {
    "lint": "biome check .",
    "prepare": "ivan-git-hooks install"
  }
}
```

```json
// tsconfig.json
{ "extends": "@ivan-cholakov/tsconfig/node" }
```

```json
// biome.json
{ "extends": ["@ivan-cholakov/biome-config/base"] }
```

Subsquid repos extend `@ivan-cholakov/tsconfig/subsquid` and
`@ivan-cholakov/biome-config/subsquid` instead, and add
`@ivan-cholakov/squid-common` as a runtime dep.

## Repo conventions

- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/).
  Scope is the affected package (e.g. `fix(tsconfig):`, `feat(squid-common):`).
- **Releases:** [release-please](https://github.com/googleapis/release-please)
  in manifest mode. Each PR's conventional-commit scope drives which
  package(s) bump on the next release.
- **Lint/format:** Biome, dogfood-extending `@ivan-cholakov/biome-config/base`.
- **TypeScript:** dogfood-extending `@ivan-cholakov/tsconfig/base`.

## Development

```bash
pnpm install
pnpm -r build
pnpm lint
```
