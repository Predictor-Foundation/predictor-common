// Client-side contracts for the node-manager pallet. The signing payloads here must be byte-for-byte
// what the pallet verifies with `using_encoded` / `RuntimeAppPublic::verify`; a single shared copy is
// the only thing that keeps a submitter (heartbeat-service) and an SDK (prdctr-sdk) from drifting
// apart and producing signatures the chain rejects.

import { concatBytes, scaleBytes, u64le, utf8 } from "@predictor-foundation/scale";

/**
 * The signature context the node-manager pallet checks. The signed payload is
 * `SCALE( ( &[u8] b"NodeManager_heartbeat", u64 heartbeat_count, u64 reward_period_index ) )`.
 */
export const HEARTBEAT_CONTEXT: Uint8Array = utf8("NodeManager_heartbeat");

/**
 * SCALE-encode the heartbeat signing payload the node-manager pallet verifies:
 * `context ++ u64(count) ++ u64(period)`. Takes a named object so the two u64s cannot be swapped at a
 * call site - swapping them yields a different, silently-rejected signature.
 */
export function heartbeatSigningPayload({
	count,
	period,
}: {
	count: bigint;
	period: bigint;
}): Uint8Array {
	return concatBytes(scaleBytes(HEARTBEAT_CONTEXT), u64le(count), u64le(period));
}
