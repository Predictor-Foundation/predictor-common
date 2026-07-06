import type { PredictorNetwork } from "./network";

/**
 * A chain coordinate that locates an item within a block by its `{block}-{index}`
 * pair. The block-explorer's "simplified" extrinsic and event IDs use exactly
 * this shape (leading zeros stripped), and the bridge dapp builds its explorer
 * links from the same two numbers (block height + extrinsic index).
 *
 * Provenance:
 * - prdctr-bridge-dapp/src/lib/predictor.ts :: `explorerExtrinsicEventsUrl`
 *   builds `${base}/predictor/extrinsic/${blockNumber}-${extrinsicIndex}/events`.
 * - block-explorer router (`extrinsic/:id/:tab?`, `event/:id`) with
 *   `simplifyExtrinsicId` / `simplifyEventId` producing `{block}-{index}`.
 */
export interface ChainCoord {
	readonly block: number;
	readonly index: number;
}

/**
 * The tabs the block-explorer renders on an extrinsic page. Named rather than a
 * bare string so link builders can't request a tab the explorer doesn't route.
 *
 * Provenance: block-explorer/packages/frontend/src/screens/extrinsic.tsx renders
 * `CallsTable` and `EventsTable`; the bridge dapp deep-links the `events` tab.
 */
export type ExtrinsicTab = "calls" | "events";

/** `{block}-{index}` - the block-explorer's simplified coordinate ID. */
function formatChainCoord(coord: ChainCoord): string {
	return `${coord.block}-${coord.index}`;
}

/** Origin + network namespace, e.g. `https://explorer.testnet.prdctr.io/predictor`. */
function explorerRoot(network: PredictorNetwork): string {
	return `${network.explorerBaseUrl}/${network.explorerNetworkPath}`;
}

/**
 * Deep-link to an extrinsic on the block-explorer, optionally focusing a tab.
 *
 * `{explorerBaseUrl}/{network}/extrinsic/{block}-{index}[/{tab}]`
 */
export function explorerExtrinsicUrl(
	network: PredictorNetwork,
	coord: ChainCoord,
	tab?: ExtrinsicTab,
): string {
	const base = `${explorerRoot(network)}/extrinsic/${formatChainCoord(coord)}`;
	return tab === undefined ? base : `${base}/${tab}`;
}

/**
 * Deep-link to an event on the block-explorer.
 *
 * `{explorerBaseUrl}/{network}/event/{block}-{index}`
 */
export function explorerEventUrl(network: PredictorNetwork, coord: ChainCoord): string {
	return `${explorerRoot(network)}/event/${formatChainCoord(coord)}`;
}

/**
 * Deep-link to a block on the block-explorer.
 *
 * `{explorerBaseUrl}/{network}/block/{block}`
 */
export function explorerBlockUrl(network: PredictorNetwork, block: number): string {
	return `${explorerRoot(network)}/block/${block}`;
}

/**
 * Deep-link to an account on the block-explorer.
 *
 * `{explorerBaseUrl}/{network}/account/{address}`
 */
export function explorerAccountUrl(network: PredictorNetwork, address: string): string {
	return `${explorerRoot(network)}/account/${address}`;
}

/**
 * The explorer GraphQL gateway URL.
 *
 * `{explorerBaseUrl}/graphql` - matches the bridge dapp's
 * `PREDICTOR_EXPLORER_GRAPHQL_URL` default (`${base}/graphql`).
 */
export function explorerGraphqlUrl(network: PredictorNetwork): string {
	return `${network.explorerBaseUrl}/graphql`;
}
