import type { PredictorNetwork, PredictorNetworkId } from "./network";
import { PREDICTOR_SS58_PREFIX } from "./ss58";

/**
 * The block-explorer route namespace shared by every Predictor network. It is
 * the block-explorer's `network.name`
 * (block-explorer/packages/frontend/src/networks.json :: `predictor.name`) and
 * appears in the bridge dapp's hardcoded explorer links
 * (`/predictor/extrinsic/...`).
 */
const EXPLORER_NETWORK_PATH = "predictor";

/** Strip trailing slashes so `explorerBaseUrl` joins cleanly - mirrors the
 * `.replace(/\/+$/, "")` normalisation the faucet and bridge dapp both apply. */
function normaliseBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

function defineNetwork(net: PredictorNetwork): PredictorNetwork {
	return { ...net, explorerBaseUrl: normaliseBaseUrl(net.explorerBaseUrl) };
}

/**
 * The public Predictor testnet, code-named "Cassandra".
 *
 * Provenance:
 * - displayName, wsEndpoints[0], explorerBaseUrl:
 *   faucet/packages/backend/src/config.ts (`DEFAULT_CHAIN_NAME`,
 *   `DEFAULT_EXPLORER_URL`) and faucet/packages/backend/src/chain.ts
 *   (`DEFAULT_WS_ENDPOINT`).
 * - ss58Prefix / decimals / tokenSymbol: faucet chain.ts `CHAIN`, matching
 *   block-explorer networks.json.
 */
export const PREDICTOR_TESTNET: PredictorNetwork = defineNetwork({
	id: "testnet",
	displayName: "Cassandra - Predictor Public Testnet",
	ss58Prefix: PREDICTOR_SS58_PREFIX,
	decimals: 10,
	tokenSymbol: "PRD",
	wsEndpoints: ["wss://chain-external.testnet.prdctr.io"],
	explorerBaseUrl: "https://explorer.testnet.prdctr.io",
	explorerNetworkPath: EXPLORER_NETWORK_PATH,
});

/**
 * The internal Predictor development network.
 *
 * Provenance:
 * - explorerBaseUrl: prdctr-bridge-dapp/src/config/bridgeConfig.ts default for
 *   `PREDICTOR_EXPLORER_BASE_URL` (`https://explorer.dev.prdctr.io`).
 * - wsEndpoints[0]: prdctr-bridge-dapp default for `PREDICTOR_WS_URL`
 *   (`ws://127.0.0.1:9944`). NOTE: this is the bridge dapp's *local-run*
 *   default, not a hosted dev RPC. There is no hosted dev WS endpoint
 *   hardcoded in any repo, so none is invented here; override via config in
 *   deployment.
 * - ss58Prefix / decimals / tokenSymbol: identical to testnet (bridge dapp
 *   `prdDecimals` default 10; SS58 42; symbol "PRD" from the shared coords).
 */
export const PREDICTOR_DEV: PredictorNetwork = defineNetwork({
	id: "dev",
	displayName: "Predictor Dev",
	ss58Prefix: PREDICTOR_SS58_PREFIX,
	decimals: 10,
	tokenSymbol: "PRD",
	wsEndpoints: ["ws://127.0.0.1:9944"],
	explorerBaseUrl: "https://explorer.dev.prdctr.io",
	explorerNetworkPath: EXPLORER_NETWORK_PATH,
});

/** All known Predictor networks, keyed by their {@link PredictorNetworkId}. */
export const PREDICTOR_NETWORKS: Readonly<Record<PredictorNetworkId, PredictorNetwork>> = {
	testnet: PREDICTOR_TESTNET,
	dev: PREDICTOR_DEV,
};

/** Total-function lookup: every {@link PredictorNetworkId} resolves to a network. */
export function getPredictorNetwork(id: PredictorNetworkId): PredictorNetwork {
	return PREDICTOR_NETWORKS[id];
}
