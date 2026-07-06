# @predictor-foundation/tsconfig

Shared TypeScript config presets.

## Presets

| Preset | Extends | Adds |
|---|---|---|
| `base` | - | `target: ES2022`, `module: commonjs`, `strict: true`, `declaration: true`, `sourceMap: true` |
| `node` | `base` | `types: ["node"]`, `incremental: true` |
| `subsquid` | `node` | `experimentalDecorators: true`, `emitDecoratorMetadata: true` (TypeORM + type-graphql) |
| `react` | `base` | `lib: ["DOM", ...]`, `jsx: "react-jsx"`, `module: ESNext`, `moduleResolution: bundler` |

## Usage

```json
// tsconfig.json
{ "extends": "@predictor-foundation/tsconfig/subsquid" }
```

Or `node`, `base`, `react` as appropriate.

## Versioning

Semver. A change to any compiler option in the JSON files is a breaking
change for downstream typecheckers and ships as a major bump. Adding a
new preset is a minor.
