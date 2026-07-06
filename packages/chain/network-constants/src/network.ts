import type { Ss58Prefix } from "./ss58";

/**
 * Identifier for a deployed Predictor network. This is the discriminant that
 * distinguishes the network coordinates found across the repos.
 *
 * - `"testnet"` - the public testnet code-named "Cassandra".
 * - `"dev"`     - the internal development network.
 *
 * Modelled as a closed union rather than a free string so a typo (`"testent"`)
 * is a compile error and every consumer switches exhaustively.
 */
export type PredictorNetworkId = "testnet" | "dev";

/**
 * A non-empty, readonly list of WebSocket endpoints for a network. The tuple
 * shape guarantees at least one endpoint exists (a network with zero RPC
 * endpoints is an unrepresentable state); {@link primaryWsEndpoint} reads the
 * head without a possible-`undefined`.
 */
export type WsEndpoints = readonly [string, ...string[]];

/**
 * The full set of coordinates needed to talk to, and link into, one Predictor
 * network. Every field is `readonly`: these are compile-time constants, not
 * mutable config.
 *
 * `explorerBaseUrl` is stored without a trailing slash (invariant enforced by
 * {@link ../networks} at construction) so path joins in `../explorer` never
 * produce a double slash.
 */
export interface PredictorNetwork {
	/** Stable machine identifier / discriminant. */
	readonly id: PredictorNetworkId;
	/** Human-facing chain name (e.g. shown in the faucet UI). */
	readonly displayName: string;
	/** SS58 address format prefix. */
	readonly ss58Prefix: Ss58Prefix;
	/** Token decimal places (planck -> whole-token divisor is `10 ** decimals`). */
	readonly decimals: number;
	/** Ticker symbol for the native token. */
	readonly tokenSymbol: string;
	/** RPC WebSocket endpoints; the head is the canonical primary. */
	readonly wsEndpoints: WsEndpoints;
	/** Block-explorer origin, no trailing slash (e.g. `https://explorer.testnet.prdctr.io`). */
	readonly explorerBaseUrl: string;
	/**
	 * Path segment the block-explorer uses to namespace this network's routes.
	 * Every explorer deep-link is `{explorerBaseUrl}/{explorerNetworkPath}/...`.
	 * This is the block-explorer `network.name`, which is `"predictor"`.
	 */
	readonly explorerNetworkPath: string;
}

/** The canonical primary WS endpoint for a network. */
export function primaryWsEndpoint(network: PredictorNetwork): string {
	return network.wsEndpoints[0];
}
