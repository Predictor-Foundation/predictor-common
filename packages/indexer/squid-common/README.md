# @predictor-foundation/squid-common

Shared building blocks for Subsquid Substrate processors in the
Predictor Foundation family.

## What's in it

- **Env parsing.** `parseProcessorEnv` validates `RPC_ENDPOINT`,
  `ARCHIVE_URL`, `BLOCK_FROM/TO`, `SS58_PREFIX` against Zod schemas.
  Fail-fast at module load.
- **SS58 codec.** `createDefaultSs58Codec` reads `SS58_PREFIX` env and
  returns a codec with `encodeAddress` / `decodeAddress`.
- **Account helpers.** `createAccountHelpers` returns
  `getOrCreateAccount` / `getOrCreateAccountFromBytes` with per-batch
  caching + first/last-seen advancement.
- **Entity cache.** `createEntityCache` is a generic read-through /
  write-through cache over `Store`. Drop-in replacement for
  hand-rolled `StoreWithCache` classes.
- **Processor builder.** `createSubstrateProcessor` configures a
  `SubstrateBatchProcessor` from one config object, with optional
  `Item` generic for per-event narrowing.
- **Event router.** `createEventRouter` dispatches a typed
  `Record<EventName, Handler>` against a chain item stream, with
  optional "tracked" handlers that emit metrics.
- **Branded primitives.** `Ss58Address`, `BlockHeight`, `HexBytes`,
  `Ss58Prefix` - Zod-validated nominal types.
- **Chain-coord IDs.** `chainCoordIdMake` /
  `chainCoordTransform` for `{block}-{ext}-{evt}` style IDs, and
  `defineChainCoordId([suffix])` to stamp out a whole
  `{ schema, make, parse, assert }` id family in one call.
- **Numeric strings.** `sumStrings`, `addStrings`, `subStrings`,
  `divStrings`, `gtZero`, `NumericAccumulator` - precision-preserving
  arithmetic over Postgres `numeric` values via `@subsquid/big-decimal`
  (null-in/null-out for absence).
- **Errors.** `BaseError` + `ErrorCode` (`DatabaseError`,
  `InvalidInputError`, `NotFoundError`) for the resolver layer, plus
  `UnknownVersionError` - a typegen version-drift guard thrown at the
  chain-decoding boundary, deliberately outside the `ErrorCode` hierarchy.
- **Substrate shape classifiers.** `classifySignatureAddress`,
  `classifyOrigin` for the chain's tagged-union envelopes.
- **JSON helpers.** `bigintReplacer`, `serializeJson`,
  `truncateJsonPayload` (returns a tagged union -
  `ok / too-large / non-serializable`).
- **Misc.** `parseSpecId`, `splitPalletEventName`, `hexToBytes`,
  `parseChainErrorField`, `decodeSubstrateData`, `assertNever`,
  `extractEventMeta`.

The full public surface lives in `src/index.ts`.

## Usage

```ts
import {
  parseProcessorEnv,
  createDefaultSs58Codec,
  createAccountHelpers,
  createSubstrateProcessor,
} from "@predictor-foundation/squid-common";

const { config } = parseProcessorEnv();
const ss58 = createDefaultSs58Codec();
const account = createAccountHelpers({ account: { /* ... */ }, codec: ss58 });
const processor = createSubstrateProcessor({ config, events: ALL_EVENTS });
```

## Versioning

Semver. The package shipped at `1.0.0` after the block-explorer + node-
manager + prediction-markets refactors stabilised the API. Breaking
changes go through a minor-deprecation cycle before removal.
