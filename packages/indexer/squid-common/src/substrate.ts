/**
 * Substrate-specific shape classifiers.
 *
 * The chain emits two structurally-similar but semantically-distinct
 * payloads that appear across most squids:
 *
 *  - **Signature address** (on `extrinsic.signature.address`): a shallow
 *    union of a hex string, a `{value}` wrapper, or a `{__kind, value}`
 *    tagged variant. Used by every squid that records the signer of an
 *    extrinsic.
 *
 *  - **Origin** (on `call.origin`): a nested `system`-then-`Signed`
 *    structure that may also wrap the inner address as `{__kind: "Id",
 *    value: ...}`. Used by handlers that need to attribute a call to its
 *    signer.
 *
 * Both classifiers return a tagged union so callers can dispatch via
 * `switch (classified.kind)` + `assertNever`. Decoding the inner hex
 * (to bytes, to SS58 string, etc.) is the caller's choice - the
 * classifiers stop at the shape level.
 */

/**
 * Classified `address` shape from `extrinsic.signature.address`.
 *
 *  - `hex`        : the address arrived as a raw hex string
 *                   (oldest runtime shape).
 *  - `wrapped`    : `{ value: "0x..." }` - wrapper without a tag.
 *  - `kinded`     : `{ __kind: "...", value: "0x..." }` - tagged variant
 *                   (e.g. `{ __kind: "Id", value: ... }`); the tag is
 *                   discarded by this classifier - callers that need it
 *                   should look at `__kind` directly.
 *  - `missing`    : the field is absent or non-extractable.
 *
 * The three "hex-containing" cases share the same `hex` field so callers
 * can collapse them into one branch after the discriminator check.
 */
export type SignatureAddress =
	| { kind: "hex"; hex: string }
	| { kind: "wrapped"; hex: string }
	| { kind: "kinded"; hex: string }
	| { kind: "missing" };

export function classifySignatureAddress(address: unknown): SignatureAddress {
	if (address == null) return { kind: "missing" };
	if (typeof address === "string") return { kind: "hex", hex: address };
	if (typeof address !== "object") return { kind: "missing" };
	const obj = address as { __kind?: unknown; value?: unknown };
	if (obj.__kind !== undefined) {
		return typeof obj.value === "string" ? { kind: "kinded", hex: obj.value } : { kind: "missing" };
	}
	if (obj.value !== undefined) {
		return typeof obj.value === "string"
			? { kind: "wrapped", hex: obj.value }
			: { kind: "missing" };
	}
	return { kind: "missing" };
}

/**
 * Classified Substrate `origin`. The chain wraps signed callers in a
 * pyramid: `{__kind: "system", value: {__kind: "Signed", value: <inner>}}`
 * where `<inner>` is either a bare hex string or `{__kind: "Id", value:
 * <hex>}`. Anything else (`__kind !== "system"`, or signed-but-not-Signed)
 * is classified as `unsigned`.
 *
 *  - `unsigned`   : not a signed origin (root, none, etc.) - no signer.
 *  - `signedHex`  : the inner address arrived as a hex string directly.
 *  - `signedId`   : the inner address arrived as `{__kind: "Id", value}`.
 *
 * Both signed variants carry the inner hex; callers that need the bytes
 * pass `hex` to their decoder (e.g. `@subsquid/substrate-processor`'s
 * `decodeHex`).
 */
export type Origin =
	| { kind: "unsigned" }
	| { kind: "signedHex"; hex: string }
	| { kind: "signedId"; hex: string };

export function classifyOrigin(origin: unknown): Origin {
	if (origin == null || typeof origin !== "object") return { kind: "unsigned" };
	const outer = origin as { __kind?: unknown; value?: unknown };
	if (outer.__kind !== "system") return { kind: "unsigned" };
	const inner = outer.value as { __kind?: unknown; value?: unknown } | undefined;
	if (!inner || inner.__kind !== "Signed") return { kind: "unsigned" };
	const id = inner.value as { __kind?: unknown; value?: unknown } | string;
	if (typeof id === "string") return { kind: "signedHex", hex: id };
	if (id && typeof id === "object" && id.__kind === "Id" && typeof id.value === "string") {
		return { kind: "signedId", hex: id.value };
	}
	return { kind: "unsigned" };
}
