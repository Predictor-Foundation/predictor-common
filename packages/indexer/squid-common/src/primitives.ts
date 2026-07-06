import { z } from "zod";
import { makeParserPair } from "./factory";

/**
 * Cross-squid branded primitives.
 *
 * Each squid additionally defines its own domain-specific brands (MarketId,
 * NodeId, etc.) on top of these.
 */

// ---------------------------------------------------------------------------
// SS58 address + prefix
// ---------------------------------------------------------------------------

export const Ss58AddressSchema = z
	.string()
	.min(1)
	.regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Not a base58 string")
	.brand<"Ss58Address">();
export type Ss58Address = z.infer<typeof Ss58AddressSchema>;
export const unsafeAsSs58Address = (s: string): Ss58Address => s as Ss58Address;
export const { parse: parseSs58Address, assert: assertSs58Address } =
	makeParserPair(Ss58AddressSchema);

/** Valid SS58 prefix range per substrate is 0..16383 inclusive. */
export const Ss58PrefixSchema = z.number().int().min(0).max(16383).brand<"Ss58Prefix">();
export type Ss58Prefix = z.infer<typeof Ss58PrefixSchema>;
export const { parse: parseSs58Prefix, assert: assertSs58Prefix } =
	makeParserPair(Ss58PrefixSchema);

// ---------------------------------------------------------------------------
// Hex bytes
// ---------------------------------------------------------------------------

/**
 * `0x`-prefixed hex bytes. Empty hex (`0x`) is permitted. Stored on Postgres
 * `text` columns; brand prevents accidental mixing with arbitrary strings.
 */
export const HexBytesSchema = z
	.string()
	.regex(/^0x[0-9a-fA-F]*$/, "Expected 0x-prefixed hex")
	.brand<"HexBytes">();
export type HexBytes = z.infer<typeof HexBytesSchema>;
export const unsafeAsHexBytes = (s: string): HexBytes => s as HexBytes;
export const { parse: parseHexBytes, assert: assertHexBytes } = makeParserPair(HexBytesSchema);

// ---------------------------------------------------------------------------
// Block height
// ---------------------------------------------------------------------------

/** Substrate block height. Zero is valid (genesis). */
export const BlockHeightSchema = z.bigint().nonnegative().brand<"BlockHeight">();
export type BlockHeight = z.infer<typeof BlockHeightSchema>;
export const { parse: parseBlockHeight, assert: assertBlockHeight } =
	makeParserPair(BlockHeightSchema);
