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
| `new Chain(descriptors, options)` | `options` is a discriminated union on transport (see [Transports](#transports)): the WebSocket default `{ endpoint, readTimeoutMs?=15_000, submitTimeoutMs?=120_000, onStatusChanged?, heartbeatTimeout?, logger? }`, or the smoldot light client `{ smoldot: { chainSpec }, readTimeoutMs?, submitTimeoutMs? }`. |
| `client()` / `api()` | Lazily-created, cached `PolkadotClient` / `TypedApi<D>`. |
| `read(op, label)` | A chain read wrapped in a timeout + error classification. |
| `submitSigned(tx, signer, label)` | Sign + submit; resolves `TxSuccess` at finalization, `PermanentChainError` on a failed dispatch. |
| `submitUnsigned(bytes, label)` | Broadcast bare extrinsic bytes (e.g. a pallet-verified heartbeat); resolves at finalization. |
| `finalizedHeight()` | Current finalized block height. |
| `status()` | Last observed WebSocket `StatusChange`, or `undefined` before the client has connected - and always `undefined` under the smoldot transport, which has no WS status transitions. |
| `disconnect()` | Tear down the client + subscriptions, and terminate the smoldot worker if one was started. Idempotent. |

### Connection observability

The optional `WsChainOptions` fields (WebSocket transport only) let a long-lived consumer watch connectivity:

- `onStatusChanged(status)` - called on every WebSocket transition (connecting/connected/error/close), e.g. to re-drive subscriptions after a reconnect.
- `heartbeatTimeout` - idle time (ms) before a silent socket is treated as stale and rotated (PAPI default `40_000`).
- `logger` - a `SocketLoggerFn` sink for the ws provider's own connection logs.

`status()` reports the latest transition even without an `onStatusChanged` handler. Late callbacks from a provider that a subsequent `disconnect()` has torn down are dropped, so a stale status can never repopulate after teardown.

Types: `ChainOptions` (the `WsChainOptions | SmoldotChainOptions` union), `WsChainOptions`, `SmoldotChainOptions`, `SmoldotChainConfig`, `ChainCommonOptions` (the shared `readTimeoutMs`/`submitTimeoutMs`), `SignableTx`, `TxSuccess`, `TxFinalized`, `TxHandle` (the branded "handle === tx hash"), and `SocketLoggerFn` / `StatusChange` (re-exported from `polkadot-api/ws`).

## Transports

`ChainOptions` is a discriminated union on transport. The read/submit orchestration is transport-agnostic; only how the client connects differs.

### WebSocket (default)

Keyed by `endpoint` (the original, unchanged shape). One or more RPC endpoints, with PAPI's automatic failover/rotation across them, plus the [connection observability](#connection-observability) hooks. This stays the recommended default for a submit-heavy backend.

```ts
const chain = new Chain(prd, { endpoint: "wss://rpc.predictor.io" });
```

### smoldot light client (opt-in)

Keyed by `smoldot`. smoldot syncs headers from the chain's p2p network and verifies state itself, so it depends on no single RPC (trust-minimized). It runs in a Node `worker_threads` worker so its sync/verification never blocks the caller's event loop - which is why the package requires **Node >= 20.6** (for `import.meta.resolve`) and pulls the smoldot subpaths from the existing `polkadot-api` peer dependency (no new dependency).

```ts
import { readFileSync } from "node:fs";

const chainSpec = readFileSync("predictor.chainspec.json", "utf8");
const chain = new Chain(prd, { smoldot: { chainSpec } });
```

The trade-off is a warmup sync and higher in-process resource use, plus a weaker transaction-broadcast path than a well-connected full node - so WebSocket stays the pragmatic default and smoldot is the opt-in for trust-minimization. `chainSpec` is the chain-spec JSON (as a string) carrying the genesis and bootnodes. Predictor is a solo chain (Aura standalone), so its own spec is the whole story; a parachain would additionally need its relay chain's spec, which is not modelled here yet. `disconnect()` terminates the smoldot worker.

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
