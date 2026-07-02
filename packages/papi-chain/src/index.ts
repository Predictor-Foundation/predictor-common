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
import { getWsProvider } from "polkadot-api/ws";

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

export interface ChainOptions {
	/** WebSocket endpoint(s). An array enables PAPI's automatic failover/rotation. */
	readonly endpoint: string | string[];
	/** Per-read RPC timeout (ms). A hung socket must not stall a call. Default 15_000. */
	readonly readTimeoutMs?: number;
	/** Submit timeout (ms). A submit resolves only at finalization, so this is far larger. Default 120_000. */
	readonly submitTimeoutMs?: number;
}

const DEFAULT_READ_TIMEOUT_MS = 15_000;
const DEFAULT_SUBMIT_TIMEOUT_MS = 120_000;

/**
 * The network boundary without typed descriptors. The client is created lazily and cached; call
 * {@link ChainBase.disconnect} to tear it (and every chainHead subscription) down.
 */
export class ChainBase {
	readonly #endpoint: string | string[];
	readonly #readTimeoutMs: number;
	readonly #submitTimeoutMs: number;
	#client: PolkadotClient | undefined;

	constructor(options: ChainOptions) {
		this.#endpoint = options.endpoint;
		this.#readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
		this.#submitTimeoutMs = options.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
	}

	/** The cached PAPI client (created on first use). */
	client(): PolkadotClient {
		if (!this.#client) this.#client = createClient(getWsProvider(this.#endpoint));
		return this.#client;
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

	/** Tear down the client and all its subscriptions. Idempotent. */
	disconnect(): void {
		this.#client?.destroy();
		this.#client = undefined;
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
