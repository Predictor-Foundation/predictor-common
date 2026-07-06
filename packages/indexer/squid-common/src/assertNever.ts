/**
 * Compile-time exhaustiveness assertion. Place in default branches of a
 * switch over a discriminated union; the compiler reports any new variant
 * that doesn't have a branch.
 */
export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`);
}
