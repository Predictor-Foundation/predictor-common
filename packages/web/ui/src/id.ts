/**
 * Simplify a composite, hyphen-delimited entity id for display by dropping the
 * block-hash segment and stripping leading zeros from the remaining numeric
 * segments (an all-zero segment collapses to `"0"`).
 *
 * Generic over the id shape: the caller supplies the `pattern` that recognises a
 * not-yet-simplified id and the `blockHashIndex` of the segment to remove, so no
 * particular id layout is baked in. An id that does not match `pattern` is
 * assumed already simplified and returned unchanged.
 */
export function simplifyId(id: string, pattern: RegExp, blockHashIndex: number): string {
	if (!id.match(pattern)) {
		return id;
	}

	const parts = id.split("-");
	parts.splice(blockHashIndex, 1);

	return parts.map((part) => part.replace(/^0+/, "") || "0").join("-");
}
