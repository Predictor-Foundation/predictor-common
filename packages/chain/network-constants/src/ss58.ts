/**
 * SS58 address-format prefix as a nominal (branded) type.
 *
 * The chain's SS58 prefix is a small integer in the Substrate registry range
 * `[0, 16383]`. Modelling it as a plain `number` would let any integer (or a
 * negative, or a float) flow into an address codec unnoticed. `Ss58Prefix` is
 * therefore a branded value produced only by {@link ss58Prefix} (parse, don't
 * validate): once you hold one, it is guaranteed to be a valid prefix.
 */
export type Ss58Prefix = number & { readonly __brand: "Ss58Prefix" };

/** Inclusive upper bound of the Substrate SS58 registry prefix range. */
const SS58_PREFIX_MAX = 16383;

/**
 * Smart constructor for {@link Ss58Prefix}. Returns `null` for anything that is
 * not an integer in `[0, SS58_PREFIX_MAX]`, so callers must handle the failure
 * at the boundary rather than discovering it inside a codec.
 */
export function ss58Prefix(value: number): Ss58Prefix | null {
	if (!Number.isInteger(value) || value < 0 || value > SS58_PREFIX_MAX) {
		return null;
	}
	return value as Ss58Prefix;
}

/**
 * Construct an {@link Ss58Prefix} from a value already known to be valid (e.g.
 * a literal encoded in this package). Throws if the invariant is violated so a
 * bad constant fails loudly at module load instead of silently.
 */
export function unsafeSs58Prefix(value: number): Ss58Prefix {
	const parsed = ss58Prefix(value);
	if (parsed === null) {
		throw new Error(`Invalid SS58 prefix: ${value} (expected integer in [0, ${SS58_PREFIX_MAX}])`);
	}
	return parsed;
}

/**
 * The Predictor SS58 address format. Prefix `42` is the generic Substrate
 * format and is used identically across every Predictor surface.
 *
 * Provenance (all agree on 42):
 * - faucet/packages/backend/src/chain.ts :: `CHAIN.ss58Prefix`
 * - prdctr-bridge-dapp/src/lib/predictor.ts :: `PREDICTOR_SS58_FORMAT`
 * - block-explorer/packages/frontend/src/networks.json :: `predictor.prefix`
 */
export const PREDICTOR_SS58_PREFIX: Ss58Prefix = unsafeSs58Prefix(42);
