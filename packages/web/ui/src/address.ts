import { hexToU8a, isHex, u8aToHex } from "@polkadot/util";
import {
	ethereumEncode,
	isAddress,
	isEthereumAddress,
	decodeAddress as ss58Decode,
	encodeAddress as ss58Encode,
} from "@polkadot/util-crypto";

/**
 * Substrate (SS58) and Ethereum address helpers. Generic over any chain: the
 * SS58 prefix is always an explicit parameter, never a hardcoded default, so
 * these functions carry no assumption about which network they run against.
 */

/**
 * Decode any address to its hex public key. Best-effort display helper: on a
 * value that cannot be decoded, the input is returned unchanged.
 */
export function decodeAddress(address: string): string {
	try {
		return u8aToHex(ss58Decode(address));
	} catch {
		return address;
	}
}

/**
 * Re-encode an address for the given SS58 `prefix`. A 20-byte key is treated as
 * an Ethereum account and checksum-encoded; anything else is SS58-encoded with
 * `prefix`. Best-effort: undecodable input is returned unchanged.
 */
export function encodeAddress(address: string, prefix: number): string {
	try {
		const bytes = isHex(address) ? hexToU8a(address) : ss58Decode(address);
		return bytes.length === 20 ? ethereumEncode(bytes) : ss58Encode(bytes, prefix);
	} catch {
		return address;
	}
}

/**
 * True when `address` is a valid address already in its canonical encoded form
 * for `prefix` (round-trips through {@link encodeAddress} unchanged).
 */
export function isEncodedAddress(address: string, prefix: number): boolean {
	return isAddress(address) && address === encodeAddress(address, prefix);
}

/** True when `str` is a hex-encoded account public key. */
export function isAccountPublicKey(str: string): boolean {
	return isHex(str) && isAddress(str);
}

/**
 * Parse an Ethereum address into its EIP-55 checksummed form, or `null` when
 * `address` is not a valid Ethereum address. Smart constructor: the branded
 * `0x${string}` return type is only produced for valid input.
 */
export function normaliseEthAddress(address: string): `0x${string}` | null {
	if (!isEthereumAddress(address)) {
		return null;
	}
	return ethereumEncode(address) as `0x${string}`;
}
