# @predictor-foundation/env

Zod-based environment parsing primitives. Every Predictor service parses
`process.env` the same way - "validate against a schema at boot, fail loud on
the first bad value" - and each had hand-rolled the same helpers. This package
owns *how* env is parsed; your service owns *which* variables it reads.

## Usage

```ts
import { z } from "zod";
import { parseEnv, requiredString, stringEnv, positiveIntEnv, portEnv } from "@predictor-foundation/env";

const Schema = z.object({
	KEYS_FILE: requiredString(),
	WS_ENDPOINT: stringEnv("wss://chain-external.testnet.prdctr.io"),
	TICK_INTERVAL_MS: positiveIntEnv(15_000),
	PORT: portEnv(8080),
});

// Throws `config: PORT: ...; KEYS_FILE: ...` listing every bad var at once.
const env = parseEnv(Schema, { label: "config" });
```

## Exports

- `parseEnv(schema, options?)` - fail-fast parse; throws one readable error.
- `blankAsUndefined` - preprocessor treating `""` as unset (apply before readers).
- Readers: `requiredString()`, `stringEnv(fallback)`, `positiveIntEnv(fallback)`,
  `intEnv(fallback)`, `portEnv(fallback)`, `boolEnv(fallback)`.
- Type: `ParseEnvOptions`.

Empty-string env vars are treated as unset by every reader, so a container that
injects `PORT=""` still gets the default. `boolEnv` rejects unrecognised
spellings rather than coercing a typo to `false`.
