// sr25519 key derivation + address/public-key helpers for the Predictor Foundation PAPI services.
// A single, shared interpretation of a secret URI (`parseSuri`) that both signing and address-only
// derivation route through, so they can never disagree about what a given URI means.

import { getSs58AddressInfo } from "@polkadot-api/substrate-bindings";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import {
	DEV_PHRASE,
	entropyToMiniSecret,
	mnemonicToEntropy,
	ss58Address,
} from "@polkadot-labs/hdkd-helpers";
import { fromHex, toHex } from "@predictor-foundation/scale";
import {
	assertSs58,
	PRD_SS58_PREFIX,
	type Ss58Address,
} from "@predictor-foundation/substrate-primitives";
import { getPolkadotSigner, type PolkadotSigner } from "polkadot-api/signer";

/**
 * An sr25519 keypair the SDK can both sign *signed extrinsics* with (via {@link Keypair.signer}) and
 * sign *raw payloads* with (via {@link Keypair.sign}, used e.g. for the node-manager heartbeat, whose
 * signature is embedded in an unsigned extrinsic the pallet verifies itself).
 */
export interface Keypair {
	/** The 32-byte sr25519 public key. */
	readonly publicKey: Uint8Array;
	/** SS58 address (prefix 42) for this key. */
	readonly address: Ss58Address;
	/** A PAPI signer for `signAndSubmit` on signed extrinsics. */
	readonly signer: PolkadotSigner;
	/** Sign a raw message with the private key (non-deterministic sr25519). */
	sign(message: Uint8Array): Uint8Array;
}

/** The two inputs sr25519 derivation needs: the seed and the junction path applied to it. */
export interface Suri {
	readonly miniSecret: Uint8Array;
	readonly path: string;
}

/**
 * Parse a secret URI into the mini-secret + derivation path a keypair derives from. This is the
 * single, shared interpretation of a secret; every caller (signing *and* address-only derivation)
 * routes through it so they cannot disagree about what a given URI means.
 *
 * Accepts either a raw 32-byte mini-secret (`0x` + 64 hex) or a BIP39 mnemonic optionally followed
 * by a substrate junction path (`//node/1`). An empty phrase (a bare `//Alice`-style path) means the
 * well-known dev mnemonic. The hard-password form (`<phrase>///pw`) is rejected: subkey folds the
 * password into the mini-secret rather than the path, so parsing it as a path would silently derive
 * a *different* key - the exact divergence a shared parser exists to prevent.
 */
export function parseSuri(secret: string): Suri {
	const trimmed = secret.trim();
	if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
		return { miniSecret: fromHex(trimmed), path: "" };
	}
	if (trimmed.includes("///")) {
		throw new Error("password-form secret URIs (`///password`) are not supported");
	}
	const slash = trimmed.indexOf("/");
	const rawPhrase = (slash === -1 ? trimmed : trimmed.slice(0, slash)).trim();
	const phrase = rawPhrase === "" ? DEV_PHRASE : rawPhrase;
	const path = slash === -1 ? "" : trimmed.slice(slash);
	return { miniSecret: entropyToMiniSecret(mnemonicToEntropy(phrase)), path };
}

/** Derive an sr25519 keypair from a secret (see {@link parseSuri} for the accepted forms). */
export function deriveKeypair(secret: string): Keypair {
	const { miniSecret, path } = parseSuri(secret);
	return wrap(sr25519CreateDerive(miniSecret)(path));
}

/** Derive a well-known dev account (e.g. `//Alice`, `//Bob`) from the standard dev phrase. */
export function deriveDev(path: `//${string}`): Keypair {
	const derive = sr25519CreateDerive(entropyToMiniSecret(mnemonicToEntropy(DEV_PHRASE)));
	return wrap(derive(path));
}

function wrap(keypair: { publicKey: Uint8Array; sign: (m: Uint8Array) => Uint8Array }): Keypair {
	return {
		publicKey: keypair.publicKey,
		address: assertSs58(ss58Address(keypair.publicKey, PRD_SS58_PREFIX)),
		signer: getPolkadotSigner(keypair.publicKey, "Sr25519", keypair.sign),
		sign: keypair.sign,
	};
}

/**
 * Address/public-key helpers, mirroring `avn-api`'s `AccountUtils` static surface so callers that
 * used `sdk.accountUtils.*` keep working. Keys are sr25519, SS58 prefix 42.
 */
export const AccountUtils = {
	/** `0x`-hex public key for an SS58 address. */
	addressToPublicKey(address: string): `0x${string}` {
		const info = getSs58AddressInfo(address);
		if (!info.isValid) throw new Error(`invalid SS58 address: ${address}`);
		return toHex(info.publicKey);
	},

	/** SS58 address (prefix 42) for a `0x`-hex or raw public key. */
	publicKeyToAddress(publicKey: string): string {
		return ss58Address(fromHex(publicKey), PRD_SS58_PREFIX);
	},

	/** True if the input looks like a 32-byte `0x`-hex public key (not an SS58 address). */
	isAccountPK(account: string): boolean {
		return /^0x[0-9a-fA-F]{64}$/.test(account.trim());
	},

	/** Normalise an address-or-public-key to a `0x`-hex public key. */
	convertToPublicKeyIfNeeded(accountAddressOrPublicKey: string): `0x${string}` {
		if (AccountUtils.isAccountPK(accountAddressOrPublicKey)) {
			return accountAddressOrPublicKey.trim() as `0x${string}`;
		}
		return AccountUtils.addressToPublicKey(accountAddressOrPublicKey);
	},

	/** Normalise an address-or-public-key to an SS58 address. */
	convertToAddress(accountAddressOrPublicKey: string): string {
		if (AccountUtils.isAccountPK(accountAddressOrPublicKey)) {
			return AccountUtils.publicKeyToAddress(accountAddressOrPublicKey);
		}
		return accountAddressOrPublicKey;
	},

	/**
	 * Raw 32-byte public key for an SS58 address (the `Uint8Array` sibling of
	 * {@link AccountUtils.addressToPublicKey}, for avn-api parity). Throws on an invalid address rather
	 * than returning `null` the way avn-api did - consistent with the rest of this module.
	 */
	addressToPublicKeyBytes(address: string): Uint8Array {
		const info = getSs58AddressInfo(address);
		if (!info.isValid) throw new Error(`invalid SS58 address: ${address}`);
		return info.publicKey;
	},

	/** Normalise an address-or-public-key to raw public-key bytes (avn-api parity). */
	convertToPublicKeyBytes(accountAddressOrPublicKey: string): Uint8Array {
		if (AccountUtils.isAccountPK(accountAddressOrPublicKey)) {
			return fromHex(accountAddressOrPublicKey.trim());
		}
		return AccountUtils.addressToPublicKeyBytes(accountAddressOrPublicKey);
	},

	/**
	 * Generate a fresh sr25519 account from 32 random bytes used directly as the mini-secret. The
	 * account is recoverable from its `seed` but NOT from a BIP39 mnemonic (there is none - the bytes
	 * are not derived from word entropy), so `mnemonic` is always `null`. Back the account up by its
	 * `seed`, not a phrase.
	 */
	generateNewAccount(): {
		mnemonic: null;
		seed: `0x${string}`;
		address: string;
		publicKey: `0x${string}`;
	} {
		const seed = crypto.getRandomValues(new Uint8Array(32));
		const keypair = sr25519CreateDerive(seed)("");
		return {
			mnemonic: null,
			seed: toHex(seed),
			address: ss58Address(keypair.publicKey, PRD_SS58_PREFIX),
			publicKey: toHex(keypair.publicKey),
		};
	},

	/**
	 * Derive the SS58 address for a secret URI (mnemonic/mini-secret + optional `//path`). Uses the
	 * same {@link parseSuri} the signer does, so the address here always matches the key that signs.
	 */
	addressFromSuri(suri: string): string {
		const { miniSecret, path } = parseSuri(suri);
		return ss58Address(sr25519CreateDerive(miniSecret)(path).publicKey, PRD_SS58_PREFIX);
	},
};

export type AccountUtilsType = typeof AccountUtils;
