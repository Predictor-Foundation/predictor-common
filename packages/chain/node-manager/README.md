# @predictor-foundation/node-manager

Client-side contracts for the **node-manager pallet**, shared across the Predictor Foundation PAPI
services.

The signing payloads here must be byte-for-byte what the pallet verifies (`using_encoded` /
`RuntimeAppPublic::verify`). A single shared copy is what keeps a *submitter* (heartbeat-service) and
an *SDK* (prdctr-sdk) from drifting apart and producing signatures the chain silently rejects.

Currently exports the heartbeat contract; it is the home for further node-manager pallet contracts as
they are added.

## API

| Export | Description |
|---|---|
| `HEARTBEAT_CONTEXT` | The pallet's signature context, `b"NodeManager_heartbeat"`. |
| `heartbeatSigningPayload({ count, period })` | SCALE-encode `context ++ u64(count) ++ u64(period)`. Named object so the two u64s cannot be swapped. |

```ts
import { heartbeatSigningPayload } from "@predictor-foundation/node-manager";

const payload = heartbeatSigningPayload({ count: 3n, period: 7n });
const signature = keypair.sign(payload); // embed in the unsigned heartbeat extrinsic
```

## Scripts

```bash
pnpm build        # tsc -> lib/
pnpm test         # payload pinned vs @polkadot-api/substrate-bindings (needs Node >= 22.6)
pnpm types:check  # tsc --noEmit
```
