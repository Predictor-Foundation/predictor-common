/**
 * A GraphQL query rarely stands alone: it references named fragments via the
 * `...FragmentName` spread syntax, and those fragments may reference further
 * fragments. This module owns two secrets:
 *
 *  1. how fragment definitions are stored (a name -> definition map), and
 *  2. how a query's transitive fragment dependencies are collected and
 *     appended to produce a self-contained document.
 *
 * `FragmentRegistry` is the storage; `assembleDocument` is the reusable
 * resolution algorithm, exposed on its own so a plain `Record<string, string>`
 * of pre-formatted definitions can be resolved without constructing a registry.
 */

/** Matches a fragment spread `...Name`, capturing the fragment name. */
const FRAGMENT_SPREAD = /\.\.\.([^\s,{}()]+)/g;

function spreadNames(document: string): string[] {
	return [...document.matchAll(FRAGMENT_SPREAD)].map((match) => match[1]);
}

/**
 * Return `query` followed by the definitions of every fragment it references,
 * transitively. `lookup` resolves a fragment name to its full definition, or
 * `undefined` if unknown (unknown spreads are ignored - the server reports
 * them). Each fragment is emitted at most once, regardless of how many times it
 * is spread.
 */
export function assembleDocument(
	query: string,
	lookup: (name: string) => string | undefined,
): string {
	const collected = new Map<string, string>();
	const pending: string[] = [query];

	while (pending.length > 0) {
		const document = pending.pop();
		if (document === undefined) break;

		for (const name of spreadNames(document)) {
			if (collected.has(name)) continue;
			const definition = lookup(name);
			if (definition === undefined) continue;
			collected.set(name, definition);
			pending.push(definition);
		}
	}

	return [query, ...collected.values()].join("\n");
}

/**
 * A registry of named GraphQL fragment definitions. Register fragments once
 * (typically at module load in the consuming app), then hand the registry to
 * `fetchGraphql`, which appends only the fragments a given query actually
 * references.
 */
export class FragmentRegistry {
	private readonly definitions = new Map<string, string>();

	/** Register a raw fragment: `fragment <name> on <onType> { <body> }`. */
	registerFragment(name: string, onType: string, body: string): this {
		this.definitions.set(name, `fragment ${name} on ${onType} {\n${body}\n}`);
		return this;
	}

	/**
	 * Register a fragment over a Relay Connection type. `nodeBody` describes a
	 * single node's selection; the registry wraps it in the
	 * `edges { node { ... } } pageInfo { ... }` boilerplate shared by every
	 * paginated query, so call sites never repeat it.
	 */
	registerConnectionFragment(name: string, onType: string, nodeBody: string): this {
		return this.registerFragment(
			name,
			onType,
			[
				"edges {",
				"  node {",
				nodeBody,
				"  }",
				"}",
				"pageInfo {",
				"  startCursor",
				"  endCursor",
				"  hasNextPage",
				"  hasPreviousPage",
				"}",
			].join("\n"),
		);
	}

	/** The stored definition for `name`, or `undefined` if unregistered. */
	get(name: string): string | undefined {
		return this.definitions.get(name);
	}

	/**
	 * Return `query` followed by the definitions of every fragment it
	 * references, transitively (see `assembleDocument`).
	 */
	resolve(query: string): string {
		return assembleDocument(query, (name) => this.definitions.get(name));
	}
}
