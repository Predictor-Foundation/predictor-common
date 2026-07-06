// Branded Substrate primitives: validated addresses and balances that can only be minted through a
// guard, so "validated" is enforced by the type system rather than by convention.

import { getSs58AddressInfo } from "@polkadot-api/substrate-bindings";

/**
 * A string proven to be a valid SS58 address. The only ways to obtain one are {@link parseSs58} and
 * {@link assertSs58}, so a value of this type is always structurally valid.
 */
export type Ss58Address = string & { readonly __brand: "Ss58Address" };

/**
 * Predictor's SS58 network prefix (matches the runtime `SS58Prefix = 42`). This is used when
 * *encoding* an address from a public key; {@link parseSs58} accepts an address of any valid prefix.
 */
export const PRD_SS58_PREFIX = 42;

/**
 * Validate an SS58 address string. Returns the branded value, or `null` if the input is not a
 * well-formed SS58 address (any valid network prefix is accepted). This is the sole mint of
 * {@link Ss58Address}.
 */
export function parseSs58(input: string): Ss58Address | null {
	const trimmed = input.trim();
	const info = getSs58AddressInfo(trimmed);
	return info.isValid ? (trimmed as Ss58Address) : null;
}

/** Like {@link parseSs58} but throws {@link TypeError} on an invalid address. */
export function assertSs58(input: string): Ss58Address {
	const parsed = parseSs58(input);
	if (parsed === null) throw new TypeError(`invalid SS58 address: ${input}`);
	return parsed;
}

/**
 * A non-negative balance in the chain's smallest unit (planck). {@link asPlanck} is the only guard
 * that mints one, so a `Planck` value is always non-negative.
 */
export type Planck = bigint & { readonly __brand: "Planck" };

/** Brand a non-negative bigint as {@link Planck}; throws {@link RangeError} on a negative amount. */
export function asPlanck(value: bigint): Planck {
	if (value < 0n) {
		throw new RangeError(`planck amount must be non-negative, got ${value}`);
	}
	return value as Planck;
}
