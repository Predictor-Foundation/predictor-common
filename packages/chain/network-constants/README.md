# @predictor-foundation/network-constants

Single source of truth for **Predictor network coordinates** - the SS58 prefix,
token decimals/symbol, RPC WebSocket endpoints, and block-explorer base URLs
that are currently hardcoded and duplicated across the faucet, the bridge dapp,
and the block-explorer. Consumers should import these constants instead of
re-declaring them.

## What's in it

- **`PredictorNetwork`** - the coordinate record for one deployed network
  (`id`, `displayName`, `ss58Prefix`, `decimals`, `tokenSymbol`, `wsEndpoints`,
  `explorerBaseUrl`, `explorerNetworkPath`). Every field is `readonly`.
- **Network constants** - `PREDICTOR_TESTNET` and `PREDICTOR_DEV`, plus the
  `PREDICTOR_NETWORKS` registry and `getPredictorNetwork(id)` total lookup.
- **`Ss58Prefix`** - a branded prefix type with a smart constructor
  (`ss58Prefix`) so an out-of-range prefix can't reach an address codec.
  `PREDICTOR_SS58_PREFIX` is the shared value, `42`.
- **Explorer deep-link builders** - `explorerExtrinsicUrl`, `explorerEventUrl`,
  `explorerBlockUrl`, `explorerAccountUrl`, `explorerGraphqlUrl`, over a
  `ChainCoord` (`{block, index}`) and a named `ExtrinsicTab`.

## Usage

```ts
import {
  PREDICTOR_TESTNET,
  PREDICTOR_SS58_PREFIX,
  primaryWsEndpoint,
  explorerExtrinsicUrl,
} from "@predictor-foundation/network-constants";

const ws = primaryWsEndpoint(PREDICTOR_TESTNET); // wss://chain-external.testnet.prdctr.io
const url = explorerExtrinsicUrl(PREDICTOR_TESTNET, { block: 348030, index: 5 }, "events");
// https://explorer.testnet.prdctr.io/predictor/extrinsic/348030-5/events
```

## Encoded values

These are the **real** values found in the consumer repos - nothing here is
invented. Where a value is only known for one environment, only that
environment carries it.

### Shared coordinates (identical across every repo)

| Field | Value | Provenance |
|---|---|---|
| SS58 prefix | `42` | faucet `chain.ts :: CHAIN.ss58Prefix`; bridge dapp `predictor.ts :: PREDICTOR_SS58_FORMAT`; block-explorer `networks.json :: predictor.prefix` |
| Token decimals | `10` | faucet `chain.ts :: CHAIN.decimals`; bridge dapp `bridgeConfig.ts :: prdDecimals` default; block-explorer `networks.json :: predictor.decimals` |
| Token symbol | `PRD` | faucet `chain.ts :: CHAIN.symbol`; block-explorer `networks.json :: predictor.symbol` |
| Explorer network path | `predictor` | block-explorer `networks.json :: predictor.name` (router namespace `/{network}/...`); bridge dapp hardcodes `/predictor/extrinsic/...` |

### `PREDICTOR_TESTNET` ("Cassandra")

| Field | Value | Provenance |
|---|---|---|
| `displayName` | `Cassandra - Predictor Public Testnet` | faucet `config.ts :: DEFAULT_CHAIN_NAME` |
| `wsEndpoints[0]` | `wss://chain-external.testnet.prdctr.io` | faucet `chain.ts :: DEFAULT_WS_ENDPOINT` |
| `explorerBaseUrl` | `https://explorer.testnet.prdctr.io` | faucet `config.ts :: DEFAULT_EXPLORER_URL` |

### `PREDICTOR_DEV`

| Field | Value | Provenance |
|---|---|---|
| `explorerBaseUrl` | `https://explorer.dev.prdctr.io` | bridge dapp `bridgeConfig.ts :: PREDICTOR_EXPLORER_BASE_URL` default |
| `wsEndpoints[0]` | `ws://127.0.0.1:9944` | bridge dapp `bridgeConfig.ts :: PREDICTOR_WS_URL` default |

## Cross-repo discrepancies (deliberately preserved)

The repos do **not** agree on which environment is the default, and there is no
single hosted WS/explorer pair. Each real value is encoded on the network it
actually belongs to rather than collapsing them:

1. **Default WS endpoint differs by repo.** The faucet defaults to the hosted
   testnet (`wss://chain-external.testnet.prdctr.io`). The bridge dapp defaults
   to a **local node** (`ws://127.0.0.1:9944`). No repo hardcodes a *hosted dev*
   RPC endpoint, so `PREDICTOR_DEV.wsEndpoints` carries the bridge dapp's local
   default and should be overridden per deployment - it is not a public URL.
2. **Default explorer base differs by repo.** Faucet -> `explorer.testnet.prdctr.io`;
   bridge dapp -> `explorer.dev.prdctr.io`. These are two different
   environments, encoded as `PREDICTOR_TESTNET` and `PREDICTOR_DEV` respectively.
3. **Explorer GraphQL URL** is derived as `{explorerBaseUrl}/graphql`, matching
   the bridge dapp's `PREDICTOR_EXPLORER_GRAPHQL_URL` default. The block-explorer
   frontend instead uses per-squid gateway paths
   (`/graphql/explorer`, `/graphql/account`, `/graphql/stats`, `/graphql/gateway`
   from `networks.json :: predictor.squids`); those are explorer-internal routing
   and are intentionally **not** modelled here.

## Not encoded (out of scope)

- Ethereum-side bridge coordinates (chain id `11155111` = Sepolia, bridge/token
  contract addresses) live in the bridge dapp; they are the *other* side of the
  bridge, not Predictor network coordinates.
- On-chain storage paths (`tokenManager.avtTokenContract`, etc.) are runtime
  metadata lookups, not static network coordinates.
