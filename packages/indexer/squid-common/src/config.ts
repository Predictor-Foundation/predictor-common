import * as dotenv from "dotenv";
import { type ZodObject, type ZodRawShape, z } from "zod";
import { Ss58PrefixEnvSchema } from "./codec";

/**
 * Common base env schema. Each squid extends this with its own keys via
 * `parseProcessorEnv` and gets a fail-fast Zod parse at module load.
 *
 * `BLOCK_FROM` / `BLOCK_TO` are optional bounds for testing windows; the
 * cross-field refinement enforces `to >= from` so the processor cannot be
 * configured to do nothing.
 *
 * `SS58_PREFIX` is folded in here (rather than being read ad-hoc inside
 * `createDefaultSs58Codec`) so a misconfigured prefix fails the same
 * fail-fast Zod parse the rest of the env does. The schema reference is
 * shared so the validation logic lives in one place.
 */
export const BaseProcessorEnvSchema = z.object({
	RPC_ENDPOINT: z.string().default(""),
	ARCHIVE_URL: z.url().default("http://localhost:8888/graphql"),
	BLOCK_FROM: z.coerce.number().int().nonnegative().default(0),
	BLOCK_TO: z.coerce.number().int().nonnegative().optional(),
	SS58_PREFIX: Ss58PrefixEnvSchema,
});

export type BaseProcessorEnv = z.infer<typeof BaseProcessorEnvSchema>;

export interface ProcessorConfig {
	dataSource: { chain: string; archive: string };
	blockRange: { from: number; to?: number };
}

function ensureValidBlockRange(env: BaseProcessorEnv): void {
	if (env.BLOCK_TO != null && env.BLOCK_TO < env.BLOCK_FROM) {
		throw new Error(`BLOCK_TO (${env.BLOCK_TO}) must be >= BLOCK_FROM (${env.BLOCK_FROM})`);
	}
}

/**
 * Parse `process.env` against `BaseProcessorEnvSchema` (optionally extended
 * with extra fields). Returns the parsed env *and* a derived `ProcessorConfig`
 * that the subsquid `SubstrateBatchProcessor` consumes directly.
 *
 * Extra fields are parsed by a *separate* `extra` schema (rather than by
 * merging into the base) so the generic types compose without the conditional
 * `.merge(...).refine(...)` signature inferring `unknown`. The base and the
 * extra are still parsed against the same `process.env` record.
 *
 * Usage:
 *
 *   const { env, config } = parseProcessorEnv();
 *   // or, with extra fields:
 *   const { env, config } = parseProcessorEnv({
 *     extra: z.object({ MY_EXTRA: z.coerce.number().default(0) }),
 *   });
 */
export function parseProcessorEnv<E extends ZodRawShape = Record<string, never>>(opts?: {
	extra?: ZodObject<E>;
}): { env: BaseProcessorEnv & z.infer<ZodObject<E>>; config: ProcessorConfig } {
	dotenv.config();

	const base = BaseProcessorEnvSchema.parse(process.env);
	ensureValidBlockRange(base);

	const extra = opts?.extra
		? (opts.extra.parse(process.env) as z.infer<ZodObject<E>>)
		: ({} as z.infer<ZodObject<E>>);

	const env = { ...base, ...extra };

	const config: ProcessorConfig = {
		dataSource: { chain: env.RPC_ENDPOINT, archive: env.ARCHIVE_URL },
		blockRange: {
			from: env.BLOCK_FROM,
			...(env.BLOCK_TO != null && { to: env.BLOCK_TO }),
		},
	};
	return { env, config };
}
