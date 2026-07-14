// The single boundary between a service and polkadot-api. Everything that touches the network lives
// here, so this is the only place that produces raw PAPI/WS errors - and therefore the only place
// that classifies them (via @predictor-foundation/chain-errors).
//
// Two entry points:
//   - ChainBase  - the connection + submit plumbing WITHOUT typed descriptors. Consumers that read
//     through papi's UNTYPED api (`getUnsafeApi()` - e.g. a pallet not yet in the chain metadata) use
//     this directly.
//   - Chain<D>   - ChainBase plus a fully-typed `api()` over the consumer's own generated descriptors
//     `D`. The package ships no descriptors and is pinned to no runtime version; the consumer injects
//     them, and `chain.api()` still returns their `TypedApi<D>`.

import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import {
	classifyChainError,
	PermanentChainError,
	RetryableError,
	withTimeout,
} from "@predictor-foundation/chain-errors";
import {
	type ChainDefinition,
	createClient,
	type PolkadotClient,
	type PolkadotSigner,
	type TypedApi,
} from "polkadot-api";
import { getSmProvider } from "polkadot-api/sm-provider";
import { startFromWorker } from "polkadot-api/smoldot/from-node-worker";
import { getWsProvider, type SocketLoggerFn, type StatusChange } from "polkadot-api/ws";

// Re-exported so a consumer can type an `onStatusChanged` handler / read `status()` without reaching
// into polkadot-api's subpath directly.
export type { SocketLoggerFn, StatusChange } from "polkadot-api/ws";

/**
 * The on-chain extrinsic hash. Direct submission uses it as the transaction handle (there is no
 * separate request id), so the brand names that "handle === tx hash" contract. Minted only at the
 * submit boundary ({@link ChainBase.submitSigned}).
 */
export type TxHandle = string & { readonly __brand: "TxHandle" };

/**
 * The one shape a caller depends on from a PAPI signable transaction (`api.tx.Pallet.call(args)`).
 * Kept minimal so "how we submit" lives in one place rather than restated per call site.
 */
export interface SignableTx {
	signAndSubmit(signer: PolkadotSigner): Promise<TxFinalized>;
}

/** A submitted transaction that reached a finalized block with a successful dispatch. */
export interface TxSuccess {
	/** The on-chain extrinsic hash - the real identity, available immediately at finalization. */
	readonly txHash: TxHandle;
	/** Hash of the finalized block that included it. */
	readonly blockHash: string;
	/** Height of that block. */
	readonly blockNumber: number;
	/** Index of the extrinsic within that block - together with `blockNumber` it locates the tx in a block explorer. */
	readonly extrinsicIndex: number;
}

/** Minimal shape of PAPI's `TxFinalized` event that this boundary depends on. */
export interface TxFinalized {
	readonly txHash: string;
	readonly ok: boolean;
	readonly dispatchError?: unknown;
	readonly block: { readonly hash: string; readonly number: number; readonly index: number };
}

/** Options shared by every transport. */
export interface ChainCommonOptions {
	/** Per-read RPC timeout (ms). A hung socket must not stall a call. Default 15_000. */
	readonly readTimeoutMs?: number;
	/** Submit timeout (ms). A submit resolves only at finalization, so this is far larger. Default 120_000. */
	readonly submitTimeoutMs?: number;
}

/** WebSocket transport (the default): one or more RPC endpoints, with automatic failover across them. */
export interface WsChainOptions extends ChainCommonOptions {
	/** WebSocket endpoint(s). An array enables PAPI's automatic failover/rotation. */
	readonly endpoint: string | string[];
	/**
	 * Called on every WebSocket status transition (connecting/connected/error/close). A long-lived
	 * consumer uses it to observe connectivity and re-drive subscriptions after a reconnect; the last
	 * status is also available via {@link ChainBase.status}.
	 */
	readonly onStatusChanged?: (status: StatusChange) => void;
	/** Idle time (ms) before a silent socket is treated as stale and rotated. PAPI default is 40_000. */
	readonly heartbeatTimeout?: number;
	/** Optional sink for the ws provider's own connection logs. */
	readonly logger?: SocketLoggerFn;
}

/** Configuration for the {@link SmoldotChainOptions} light-client transport. */
export interface SmoldotChainConfig {
	/**
	 * The chain-spec JSON (as a string) smoldot syncs from - a spec carrying the genesis and bootnodes.
	 * For the Predictor solo chain this is the whole story; a parachain would additionally need its relay
	 * chain's spec (not modelled here yet).
	 */
	readonly chainSpec: string;
}

/**
 * smoldot light-client transport: syncs headers from the chain's p2p network and verifies state itself,
 * so it depends on no single RPC (trust-minimized). The trade-off is a warmup sync and higher in-process
 * resource use, and a weaker transaction-broadcast path than a well-connected full node - so WebSocket
 * stays the pragmatic default for a submit-heavy backend, and this is the opt-in for trust-minimization.
 */
export interface SmoldotChainOptions extends ChainCommonOptions {
	readonly smoldot: SmoldotChainConfig;
}

/**
 * How the chain boundary connects: a discriminated union on transport - WebSocket ({@link WsChainOptions},
 * the default, keyed by `endpoint`) or a smoldot light client ({@link SmoldotChainOptions}, keyed by
 * `smoldot`). Existing `{ endpoint, ... }` callers are unchanged; the smoldot form is purely additive.
 */
export type ChainOptions = WsChainOptions | SmoldotChainOptions;

const DEFAULT_READ_TIMEOUT_MS = 15_000;
const DEFAULT_SUBMIT_TIMEOUT_MS = 120_000;

/**
 * The network boundary without typed descriptors. The client is created lazily and cached; call
 * {@link ChainBase.disconnect} to tear it (and every chainHead subscription) down.
 */
export class ChainBase {
	readonly #options: ChainOptions;
	readonly #readTimeoutMs: number;
	readonly #submitTimeoutMs: number;
	#lastStatus: StatusChange | undefined;
	#client: PolkadotClient | undefined;
	// The smoldot instance, when the smoldot transport is in use; terminated in disconnect().
	#smoldot: ReturnType<typeof startFromWorker> | undefined;
	// Bumped on every connect and every disconnect; a WS status callback records only when its generation
	// is still current, so a late callback from a torn-down provider cannot repopulate #lastStatus.
	#generation = 0;

	constructor(options: ChainOptions) {
		this.#options = options;
		this.#readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
		this.#submitTimeoutMs = options.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
	}

	/** The cached PAPI client (created on first use, over the configured WS or smoldot transport). */
	client(): PolkadotClient {
		if (!this.#client) {
			const provider =
				"smoldot" in this.#options
					? this.#smoldotProvider(this.#options.smoldot)
					: this.#wsProvider(this.#options);
			this.#client = createClient(provider);
		}
		return this.#client;
	}

	/** Build a WS provider that records status transitions (generation-guarded) and forwards them on. */
	#wsProvider(options: WsChainOptions) {
		const generation = ++this.#generation;
		const forward = options.onStatusChanged;
		return getWsProvider(options.endpoint, {
			// Record every transition so `status()` reports the latest even without an app callback, then
			// forward. A callback from a provider superseded by a later disconnect() is dropped by the guard.
			onStatusChanged: (status) => {
				if (generation !== this.#generation) return;
				this.#lastStatus = status;
				forward?.(status);
			},
			...(options.heartbeatTimeout !== undefined
				? { heartbeatTimeout: options.heartbeatTimeout }
				: {}),
			...(options.logger ? { logger: options.logger } : {}),
		});
	}

	/**
	 * Build a smoldot light-client provider. smoldot runs in a Node worker thread so its header sync and
	 * state verification never block the caller's event loop; the instance is held for teardown in
	 * {@link disconnect}. The chain-factory form (PAPI V2) lets the provider recreate the chain if smoldot
	 * destroys it during recovery.
	 */
	#smoldotProvider(config: SmoldotChainConfig) {
		const worker = new Worker(
			fileURLToPath(import.meta.resolve("polkadot-api/smoldot/node-worker")),
		);
		const smoldot = startFromWorker(worker);
		this.#smoldot = smoldot;
		return getSmProvider(() => smoldot.addChain({ chainSpec: config.chainSpec }));
	}

	/**
	 * The last observed WebSocket status, or `undefined` before connecting - and always `undefined` under
	 * the smoldot transport, which has no WS status transitions.
	 */
	status(): StatusChange | undefined {
		return this.#lastStatus;
	}

	/** Wrap a chain read with a timeout and error classification. */
	async read<T>(op: Promise<T>, label: string): Promise<T> {
		try {
			return await withTimeout(op, this.#readTimeoutMs, label);
		} catch (err) {
			throw classifyChainError(err);
		}
	}

	/**
	 * Sign and submit a signed extrinsic, resolving only when it is finalized with a successful
	 * dispatch. A finalized-but-failed dispatch (`ok === false`) is a {@link PermanentChainError}.
	 * `tx` is any PAPI transaction (`api.tx.Pallet.call(args)`), typed as the minimal shape we use.
	 */
	async submitSigned(tx: SignableTx, signer: PolkadotSigner, label: string): Promise<TxSuccess> {
		try {
			const result = await withTimeout(tx.signAndSubmit(signer), this.#submitTimeoutMs, label);
			if (!result.ok) {
				throw new PermanentChainError(
					`${label}: dispatch failed: ${stringify(result.dispatchError)}`,
				);
			}
			return {
				// The finalized extrinsic hash IS the handle; brand it here, at the boundary that produces
				// it, so the "handle === tx hash" contract is minted in exactly one place.
				txHash: result.txHash as TxHandle,
				blockHash: result.block.hash,
				blockNumber: result.block.number,
				extrinsicIndex: result.block.index,
			};
		} catch (err) {
			throw classifyChainError(err);
		}
	}

	/**
	 * Broadcast raw extrinsic bytes (an unsigned/bare tx built with `getBareTx()`) and resolve at
	 * finalization. Used for a payload whose signature is embedded in the call and verified by the
	 * pallet rather than the transaction envelope. Uses the observable submit so a timeout can
	 * `unsubscribe()` and never leak a chainHead subscription.
	 */
	submitUnsigned(bytes: Uint8Array, label: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let settled = false;
			let subscription: { unsubscribe(): void } | undefined;

			const finish = (fn: () => void) => {
				if (settled) return;
				settled = true;
				subscription?.unsubscribe();
				clearTimeout(timer);
				fn();
			};

			const timer = setTimeout(() => {
				finish(() => reject(new RetryableError(`${label}: submit timed out`)));
			}, this.#submitTimeoutMs);

			subscription = this.client()
				.submitAndWatch(bytes)
				.subscribe({
					next: (event) => {
						if (event.type === "txBestBlocksState" && !event.found && !event.isValid) {
							finish(() => reject(new PermanentChainError(`${label}: invalidated in best block`)));
							return;
						}
						if (event.type !== "finalized") return;
						if (event.ok) finish(resolve);
						else {
							finish(() =>
								reject(
									new PermanentChainError(
										`${label}: finalized but dispatch failed: ${stringify(event.dispatchError)}`,
									),
								),
							);
						}
					},
					error: (err) => finish(() => reject(classifyChainError(err))),
					complete: () =>
						finish(() => reject(new PermanentChainError(`${label}: ended before finalization`))),
				});

			if (settled) subscription.unsubscribe();
		});
	}

	/** Current finalized block height. */
	async finalizedHeight(): Promise<number> {
		const block = await this.read(this.client().getFinalizedBlock(), "getFinalizedBlock");
		return block.number;
	}

	/** Tear down the client, its subscriptions, and the smoldot instance (if any). Idempotent. */
	disconnect(): void {
		// Invalidate the current provider's status callbacks before tearing it down.
		this.#generation++;
		this.#client?.destroy();
		this.#client = undefined;
		this.#lastStatus = undefined;
		// terminate() can reject (AlreadyDestroyedError/CrashError if the worker already crashed); teardown
		// is best-effort and idempotent, so swallow it rather than leak an unhandled rejection.
		this.#smoldot?.terminate().catch(() => {});
		this.#smoldot = undefined;
	}
}

/**
 * {@link ChainBase} plus a fully-typed `api()` over the consumer's descriptors `D`. Each consumer
 * generates its own PAPI descriptors (`papi add`) from the chain metadata and injects them here, so
 * this package ships none and is pinned to no runtime version.
 */
export class Chain<D extends ChainDefinition> extends ChainBase {
	readonly #descriptors: D;
	#api: TypedApi<D> | undefined;

	constructor(descriptors: D, options: ChainOptions) {
		super(options);
		this.#descriptors = descriptors;
	}

	/** The typed API over the injected descriptors (created on first use). */
	api(): TypedApi<D> {
		if (!this.#api) this.#api = this.client().getTypedApi(this.#descriptors);
		return this.#api;
	}

	/** Tear down the client, its subscriptions, and the cached typed API. Idempotent. */
	override disconnect(): void {
		this.#api = undefined;
		super.disconnect();
	}
}

function stringify(value: unknown): string {
	return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}
