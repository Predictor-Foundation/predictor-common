// Minimal, dependency-free SCALE codec helpers. A handful of primitives - enough to build the
// signing payloads Substrate pallets verify with `using_encoded` (e.g. node-manager heartbeats and
// avn-proxy meta-transaction proofs) - kept explicit rather than pulling a full codec, so they stay
// trivial to unit-test byte-for-byte. Pinned against @polkadot-api/substrate-bindings in `test/`.

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

/** SCALE compact (variable-length) encoding of a non-negative integer. */
export function compact(value: number | bigint): Uint8Array {
	const v = BigInt(value);
	if (v < 0n) throw new RangeError("compact: value must be non-negative");
	if (v < 1n << 6n) return Uint8Array.of(Number(v) << 2);
	if (v < 1n << 14n) {
		const n = Number(v);
		return Uint8Array.of(((n << 2) | 0b01) & 0xff, (n >> 6) & 0xff);
	}
	if (v < 1n << 30n) {
		const n = Number(v);
		return Uint8Array.of(
			((n << 2) | 0b10) & 0xff,
			(n >> 6) & 0xff,
			(n >> 14) & 0xff,
			(n >> 22) & 0xff,
		);
	}
	// big-integer mode: length prefix then little-endian bytes
	const bytes: number[] = [];
	let x = v;
	while (x > 0n) {
		bytes.push(Number(x & 0xffn));
		x >>= 8n;
	}
	return Uint8Array.of((((bytes.length - 4) << 2) | 0b11) & 0xff, ...bytes);
}

/** Little-endian encoding of a u64. */
export function u64le(value: bigint): Uint8Array {
	const out = new Uint8Array(8);
	let x = BigInt.asUintN(64, value);
	for (let i = 0; i < 8; i++) {
		out[i] = Number(x & 0xffn);
		x >>= 8n;
	}
	return out;
}

export function utf8(s: string): Uint8Array {
	return new TextEncoder().encode(s);
}

/** SCALE-encode a byte string as `Vec<u8>` / `&[u8]`: compact length then bytes. */
export function scaleBytes(bytes: Uint8Array): Uint8Array {
	return concatBytes(compact(bytes.length), bytes);
}

export function toHex(bytes: Uint8Array): `0x${string}` {
	let s = "";
	for (const b of bytes) s += b.toString(16).padStart(2, "0");
	return `0x${s}`;
}

export function fromHex(hex: string): Uint8Array {
	const h = hex.startsWith("0x") ? hex.slice(2) : hex;
	if (h.length % 2 !== 0) throw new Error("fromHex: odd-length hex string");
	const out = new Uint8Array(h.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}
