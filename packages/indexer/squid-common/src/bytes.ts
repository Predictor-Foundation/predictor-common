import { type HexBytes, unsafeAsHexBytes } from "./primitives";

/**
 * `0x`-prefixed lowercase hex of the input bytes.
 *
 * Postgres `text` cannot store NUL bytes; hex is stable and matches
 * explorer/substrate conventions.
 *
 * Empty input returns canonical `0x` rather than an empty string so the
 * postcondition "result matches /^0x[0-9a-f]*$/" holds for every input. The
 * brand (`HexBytes`) is applied via `unsafeAsHexBytes` because the function
 * is the producer - re-validating its own output would be circular.
 */
export function encodeOpaqueBytesAsHex(bytes: Uint8Array): HexBytes {
	return unsafeAsHexBytes(
		`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`,
	);
}

/**
 * Decode chain-delivered bytes for human-entered text payloads. UTF-8 when
 * the bytes form valid text without NUL; hex fallback otherwise (Postgres
 * `text` cannot store NUL).
 *
 * Do NOT use for opaque payloads like multihashes: their bytes are often
 * valid UTF-8 sequences but are not text (would decode to control
 * characters instead of hex).
 */
export function decodeMetadataBytes(bytes: Uint8Array): string {
	if (bytes.length === 0) return "";
	try {
		const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return text.includes("\0") ? encodeOpaqueBytesAsHex(bytes) : text;
	} catch {
		return encodeOpaqueBytesAsHex(bytes);
	}
}

/**
 * Convert a `0x`-prefixed (or bare) hex string into a packed `Uint8Array`.
 * Empty / nullish input returns an empty array so callers can defensively
 * `?? new Uint8Array()`.
 *
 * Mirrors `@subsquid/substrate-processor`'s `decodeHex` but tolerant of
 * inputs without the `0x` prefix (squid event payloads carry either form
 * depending on the runtime's metadata version).
 */
export function hexToBytes(hex: string): Uint8Array {
	if (!hex) return new Uint8Array();
	const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
	const bytes = new Uint8Array(cleanHex.length / 2);
	for (let i = 0; i < cleanHex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
	}
	return bytes;
}

/**
 * Coerce a chain-supplied `error` field into a plain object.
 *
 * The Substrate runtime emits the field in three observed shapes:
 *  - already an object (canonical case)
 *  - JSON-encoded string (older runtime versions)
 *  - "[object Object]" stringification leak (a Substrate-side bug; the
 *    runtime calls `String(error)` somewhere and the leak surfaces here)
 *
 * Returns `null` for anything that doesn't cleanly round-trip to an
 * object. The caller is expected to treat `null` as "no recoverable
 * error info" and store `null` in the Postgres `jsonb` column - never
 * a string the GraphQL layer would refuse to deserialize.
 */
export function parseChainErrorField(error: unknown): object | null {
	if (!error) return null;
	if (typeof error === "object") return error as object;
	if (typeof error === "string") {
		if (error === "[object Object]" || error.includes("[object")) {
			return null;
		}
		try {
			const parsed = JSON.parse(error);
			return typeof parsed === "object" ? parsed : null;
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Decode the Substrate `Data` enum the chain attaches to identity-style
 * fields. Variants:
 *  - `None`        → null
 *  - `Raw0..Raw32` → utf-8 string (chain pads with NULs; stripped here)
 *  - `BlakeTwo256` / `Sha256` / `Keccak256` / `ShaThree256` → hex-encoded
 *    bytes via `encodeOpaqueBytesAsHex`
 *
 * The default branch covers `Raw*` because the chain emits dozens of
 * variants (`Raw0`, `Raw1`, ..., `Raw32`) and treating them uniformly is
 * simpler than enumerating each. Hash variants are explicit so a new
 * hash kind would silently fall into the default and decode incorrectly
 * - if you see a `0xdeadbeef` in a column that should be text, that's
 * the signal.
 */
export function decodeSubstrateData(data: { __kind: string; value?: Uint8Array }): string | null {
	switch (data.__kind) {
		case "None":
			return null;
		case "BlakeTwo256":
		case "Sha256":
		case "Keccak256":
		case "ShaThree256": {
			const val = data.value;
			return val ? encodeOpaqueBytesAsHex(val) : null;
		}
		default: {
			const val = data.value;
			if (!val) return null;
			return Buffer.from(val).toString("utf-8").split("\0").join("");
		}
	}
}
