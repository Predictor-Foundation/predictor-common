import { codec, decode as ss58Decode } from "@subsquid/ss58";
import { z } from "zod";
import {
	assertSs58Prefix,
	type Ss58Address,
	type Ss58Prefix,
	unsafeAsSs58Address,
} from "./primitives";

/**
 * Env-string -> validated SS58 prefix. Single source of truth, used by both
 * `BaseProcessorEnvSchema` (so misconfigured `SS58_PREFIX` fails the same
 * Zod parse the rest of the env does) and `createDefaultSs58Codec` (so a
 * caller that imports the codec module before `parseProcessorEnv()` runs
 * still gets the same validation). Defaults to 42 (generic substrate).
 */
export const Ss58PrefixEnvSchema = z.coerce.number().int().min(0).max(16383).default(42);

/**
 * Build a `Ss58Address` codec bound to a given prefix.
 *
 * Each squid reads its prefix from its own env (typically `SS58_PREFIX`) and
 * threads the value through `createSs58Codec`. The prefix is validated at
 * factory-call time via `assertSs58Prefix` (Zod range check 0..16383, throws
 * on invalid) - misconfigured envs fail fast before the first block is
 * touched.
 *
 * `encodeAddress` is bound to the codec instance so call sites can destructure
 * it (`const { encodeAddress } = ss58`) without losing `this`.
 */
export interface Ss58Codec {
	readonly prefix: Ss58Prefix;
	readonly encodeAddress: (id: Uint8Array) => Ss58Address;
	/**
	 * Decode an SS58 string back to raw account bytes. Prefix-agnostic: the
	 * SS58 envelope is self-describing, so this accepts any prefix, not only
	 * this codec's. Throws on malformed input - callers decoding chain-derived
	 * addresses already trust the input is well-formed.
	 */
	readonly decodeAddress: (address: string) => Uint8Array;
}

export function createSs58Codec(prefix: number): Ss58Codec {
	const validated = assertSs58Prefix(prefix);
	const inner = codec(validated as unknown as number);
	const encodeAddress = (id: Uint8Array): Ss58Address => unsafeAsSs58Address(inner.encode(id));
	const decodeAddress = (address: string): Uint8Array => ss58Decode(address).bytes;
	return { prefix: validated, encodeAddress, decodeAddress };
}

/**
 * Convenience helper: read the prefix from `process.env.SS58_PREFIX`
 * (defaulting to 42, the generic substrate prefix) and build the codec. Use
 * when the prefix env-var name is the same across squids.
 *
 * Shares its Zod validator with `BaseProcessorEnvSchema.SS58_PREFIX`, so the
 * validation runs at most once but the same misconfiguration is rejected
 * the same way regardless of import order.
 */
export function createDefaultSs58Codec(): Ss58Codec {
	const prefix = Ss58PrefixEnvSchema.parse(process.env.SS58_PREFIX);
	return createSs58Codec(prefix);
}
