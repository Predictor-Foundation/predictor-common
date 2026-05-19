# @predictor-foundation/biome-config

Shared Biome lint + format presets.

## Presets

| Preset | Extends | Adds |
|---|---|---|
| `base` | - | tab indent, 100-col line, double quotes, recommended ruleset + a curated set of warns (`noUnusedVariables`, `noNonNullAssertion`, etc.) |
| `subsquid` | `base` | `unsafeParameterDecoratorsEnabled: true` (for TypeORM `@PrimaryColumn` etc.), excludes `db/` from formatting |
| `react` | `base` | `useJsxKeyInIterable: off`, `useHookAtTopLevel: off`, `a11y: warn` |

## Usage

```json
// biome.json
{ "extends": ["@predictor-foundation/biome-config/subsquid"] }
```

The package pins `@biomejs/biome@2.3.14` as a regular dependency, so
consumers inherit the Biome version without thinking about it. Bumping
Biome is a release of this package, not a per-repo dependency edit.

## Versioning

Semver. Adding a new warn or error rule is a minor bump (consumers may
see new diagnostics but builds continue). Flipping a `warn` → `error`,
or any rule that breaks CI on existing code, is a major bump.
