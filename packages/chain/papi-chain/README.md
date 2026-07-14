# @predictor-foundation/papi-chain

The single, descriptor-generic **network boundary** between a Predictor Foundation service and
`polkadot-api`. Everything that touches the chain lives here, so this is the only place that produces
raw PAPI/WS errors - and therefore the only place that classifies them (via
[`@predictor-foundation/chain-errors`](../chain-errors)).

## Descriptor-generic

`Chain` is generic over the chain's descriptors `D`. Each consumer generates its **own** PAPI
descriptors (`papi add`) from the chain metadata and injects them into the constructor, so this
package ships no descriptors and is pinned to no runtime version - while `chain.api()` still returns
the consumer's fully-typed `TypedApi<D>`.

```ts
import { Chain } from "@predictor-foundation/papi-chain";
import { prd } from "@polkadot-api/descriptors"; // the consumer's own generated descriptors

const chain = new Chain(prd, { endpoint: "wss://rpc.predictor.io" });
const api = chain.api();                 // TypedApi<typeof prd> - fully typed, no `any`
const height = await chain.finalizedHeight();
```

## API

| Member | Description |
|---|---|
| `new Chain(descriptors, options)` | `options`: `{ endpoint, readTimeoutMs?=15_000, submitTimeoutMs?=120_000, onStatusChanged?, heartbeatTimeout?, logger? }`. |
| `client()` / `api()` | Lazily-created, cached `PolkadotClient` / `TypedApi<D>`. |
| `read(op, label)` | A chain read wrapped in a timeout + error classification. |
| `submitSigned(tx, signer, label)` | Sign + submit; resolves `TxSuccess` at finalization, `PermanentChainError` on a failed dispatch. |
| `submitUnsigned(bytes, label)` | Broadcast bare extrinsic bytes (e.g. a pallet-verified heartbeat); resolves at finalization. |
| `finalizedHeight()` | Current finalized block height. |
| `status()` | Last observed WebSocket `StatusChange`, or `undefined` before the client has connected. |
| `disconnect()` | Tear down the client + subscriptions. Idempotent. |

### Connection observability

The optional `ChainOptions` fields let a long-lived consumer watch connectivity:

- `onStatusChanged(status)` - called on every WebSocket transition (connecting/connected/error/close), e.g. to re-drive subscriptions after a reconnect.
- `heartbeatTimeout` - idle time (ms) before a silent socket is treated as stale and rotated (PAPI default `40_000`).
- `logger` - a `SocketLoggerFn` sink for the ws provider's own connection logs.

`status()` reports the latest transition even without an `onStatusChanged` handler. Late callbacks from a provider that a subsequent `disconnect()` has torn down are dropped, so a stale status can never repopulate after teardown.

Types: `ChainOptions`, `SignableTx`, `TxSuccess`, `TxFinalized`, `TxHandle` (the branded "handle === tx hash"), and `SocketLoggerFn` / `StatusChange` (re-exported from `polkadot-api/ws`).

## Install

```bash
pnpm add @predictor-foundation/papi-chain
pnpm add polkadot-api   # peer
```

## Scripts

```bash
pnpm build        # tsc -> lib/
pnpm test         # orchestration tests, no network (needs Node >= 22.6)
pnpm types:check  # tsc --noEmit
```
