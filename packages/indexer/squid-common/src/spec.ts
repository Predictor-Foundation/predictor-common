/**
 * Parse a Subsquid `specId` of the form `${specName}@${specVersion}`,
 * e.g. `"prd-parachain@4"` → `{ specName: "prd-parachain", specVersion: 4 }`.
 *
 * Returns `specVersion: undefined` for malformed input. The spec name
 * defaults to the whole input if the `@` separator is missing.
 *
 * Subsquid emits the spec on block headers when the chain undergoes a
 * runtime upgrade; squids that record runtime metadata per spec version
 * (e.g. block-explorer) need to extract both halves from this composite.
 */
export function parseSpecId(specId: string): {
	specName: string;
	specVersion: number | undefined;
} {
	const match = specId.match(/@(\d+)$/);
	if (!match) return { specName: specId, specVersion: undefined };
	return {
		specName: specId.replace(/@\d+$/, ""),
		specVersion: Number.parseInt(match[1], 10),
	};
}
