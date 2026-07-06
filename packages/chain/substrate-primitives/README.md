# @predictor-foundation/substrate-primitives

Branded Substrate primitives for the Predictor Foundation: a validated SS58 address and a
non-negative balance, each mintable only through a guard so "validated" is enforced by the type
system rather than by convention (parse, don't validate).

## Install

```bash
pnpm add @predictor-foundation/substrate-primitives
# provide the peer dependency (the PAPI ecosystem's SS58 codec)
pnpm add @polkadot-api/substrate-bindings
```

`@polkadot-api/substrate-bindings` is a **peer dependency** so the whole PAPI stack resolves a single
copy of it.

## API

| Export | Description |
|---|---|
| `type Ss58Address` | A `string` branded valid. Only `parseSs58`/`assertSs58` mint one. |
| `parseSs58(input)` | `Ss58Address \| null` - validates any valid SS58 prefix; trims input. |
| `assertSs58(input)` | `Ss58Address` - throws `TypeError` on invalid input. |
| `PRD_SS58_PREFIX` | `42` - Predictor's network prefix, for **encoding** an address from a public key (parsing accepts any prefix). |
| `type Planck` | A `bigint` branded non-negative. Only `asPlanck` mints one. |
| `asPlanck(value)` | `Planck` - throws `RangeError` on a negative amount. |

```ts
import { parseSs58, assertSs58, asPlanck } from "@predictor-foundation/substrate-primitives";

const addr = parseSs58(userInput);          // Ss58Address | null
const oracle = assertSs58(config.oracle);   // Ss58Address (throws if malformed)
const amount = asPlanck(10n ** 12n);        // Planck (throws if negative)
```

## Scripts

```bash
pnpm build        # tsc -> lib/
pnpm test         # unit tests (needs Node >= 22.6)
pnpm types:check  # tsc --noEmit
```
