# @predictor-foundation/scale

Minimal, dependency-free SCALE codec helpers for the Predictor Foundation.

Just the primitives needed to build the signing payloads Substrate pallets verify with
`using_encoded` (node-manager heartbeats, avn-proxy meta-transaction proofs, and similar), kept
explicit rather than pulling a full codec so they stay trivial to unit-test byte-for-byte. The
package has **no runtime dependencies**; its tests pin the output against
`@polkadot-api/substrate-bindings`.

## Install

```bash
pnpm add @predictor-foundation/scale
```

## API

| Function | Description |
|---|---|
| `concatBytes(...parts)` | Concatenate `Uint8Array`s. |
| `compact(value)` | SCALE compact (variable-length) encoding of a non-negative integer (`number \| bigint`). |
| `u64le(value)` | Little-endian encoding of a `u64` (`bigint`). |
| `scaleBytes(bytes)` | SCALE-encode a byte string as `Vec<u8>`: compact length prefix, then the bytes. |
| `utf8(s)` | UTF-8 encode a string. |
| `toHex(bytes)` | Lower-case `0x`-prefixed hex of a `Uint8Array`. |
| `fromHex(hex)` | Decode a hex string (with or without `0x`) to a `Uint8Array`. |

```ts
import { compact, scaleBytes, u64le, utf8, concatBytes } from "@predictor-foundation/scale";

// e.g. a node-manager heartbeat signing payload: context ++ u64(count) ++ u64(period)
const payload = concatBytes(scaleBytes(utf8("NodeManager_heartbeat")), u64le(3n), u64le(7n));
```

## Scripts

```bash
pnpm build        # tsc -> lib/
pnpm test         # byte-level tests vs @polkadot-api/substrate-bindings (needs Node >= 22.6)
pnpm types:check  # tsc --noEmit
```
