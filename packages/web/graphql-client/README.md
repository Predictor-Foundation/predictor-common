<h1>@predictor-foundation/graphql-client</h1>

<p>
	A framework-light GraphQL-over-HTTP client for Predictor Foundation
	frontends. The core is dependency-light and runs anywhere <code>fetch</code>
	exists (browser or Node &ge; 20); an optional React entry point adds
	<a href="https://swr.vercel.app/">SWR</a>-backed hooks that expose a uniform,
	discriminated-union resource shape.
</p>

<h2>Why two entry points</h2>

<p>
	The core (<code>@predictor-foundation/graphql-client</code>) imports no React
	and no SWR, so non-React consumers (scripts, other packages, a dApp's plain
	data layer) do not pull them in. The React hooks live behind a separate
	subpath (<code>@predictor-foundation/graphql-client/react</code>);
	<code>react</code> and <code>swr</code> are <em>optional peer
	dependencies</em>, needed only if you import that subpath.
</p>

<h2>Export surface</h2>

<h3><code>@predictor-foundation/graphql-client</code> (core, framework-free)</h3>

<ul>
	<li><code>fetchGraphql&lt;T&gt;(request: GraphqlRequest): Promise&lt;T&gt;</code> &mdash; POST a query, return its <code>data</code>.</li>
	<li><code>GraphqlRequest</code>, <code>FragmentSource</code> &mdash; request options and fragment-source union.</li>
	<li><code>FragmentRegistry</code> &mdash; register fragments once, resolve a query's transitive dependencies. Methods: <code>registerFragment</code>, <code>registerConnectionFragment</code>, <code>get</code>, <code>resolve</code>.</li>
	<li><code>assembleDocument(query, lookup)</code> &mdash; the standalone transitive-fragment resolver.</li>
	<li><code>NonFatalError</code> (base), <code>DataError</code>, <code>FetchError</code>, <code>NetworkError</code>, <code>GraphqlError</code> &mdash; the error hierarchy.</li>
	<li><code>ItemsConnection&lt;T, C&gt;</code>, <code>ItemsResponse&lt;T, C&gt;</code>, <code>PageInfo</code>, <code>PaginationOptions</code> &mdash; Relay-connection and page types.</li>
	<li><code>paginationToConnectionCursor</code>, <code>extractConnectionItems</code>, <code>emptyItemsResponse</code>, <code>DEFAULT_PAGE_SIZE</code> &mdash; connection-to-page mapping.</li>
</ul>

<h3><code>@predictor-foundation/graphql-client/react</code> (optional)</h3>

<ul>
	<li><code>useResource(fetchItem, args, options?)</code> &rarr; <code>Resource&lt;T&gt;</code></li>
	<li><code>usePaginatedResource(fetchItems, args, options?)</code> &rarr; <code>PaginatedResource&lt;T&gt;</code></li>
	<li><code>Resource&lt;T&gt;</code>, <code>PaginatedResource&lt;T&gt;</code>, <code>Refetch</code> &mdash; discriminated resource states.</li>
	<li><code>UseResourceOptions</code>, <code>UsePaginatedResourceOptions</code> &mdash; options (extend SWR's config).</li>
</ul>

<p>
	<code>Resource&lt;T&gt;</code> is a discriminated union on <code>status</code>:
	<code>"loading"</code>, <code>"error"</code> (carries a
	<code>NonFatalError</code>), <code>"notFound"</code>, or <code>"ready"</code>
	(carries <code>data</code>). <code>PaginatedResource&lt;T&gt;</code> replaces
	<code>notFound</code> with <code>"empty"</code> and guarantees non-empty
	<code>data</code> plus <code>pageInfo</code> in the <code>ready</code> state.
	Data is only reachable in the state where it exists &mdash; there is no
	<code>data?</code>-plus-<code>loading</code> boolean soup to guard against.
</p>

<h2>Usage &mdash; core</h2>

<pre><code>import {
	fetchGraphql,
	FragmentRegistry,
	extractConnectionItems,
	paginationToConnectionCursor,
	type ItemsConnection,
} from "@predictor-foundation/graphql-client";

const fragments = new FragmentRegistry().registerConnectionFragment(
	"eventFields",
	"EventsConnection",
	"id name block { height timestamp }",
);

type EventNode = { id: string; name: string };

async function fetchEvents(url: string, page: number) {
	const pagination = { page, pageSize: 20 };
	const { first, after } = paginationToConnectionCursor(pagination);

	const data = await fetchGraphql&lt;{ events: ItemsConnection&lt;EventNode, true&gt; }&gt;({
		url,
		query: `
			query Events($first: Int!, $after: String) {
				events: eventsConnection(first: $first, after: $after) { ...eventFields }
			}
		`,
		variables: { first, after },
		fragments,
	});

	return extractConnectionItems(data.events, pagination, (node) => node);
}
</code></pre>

<h2>Usage &mdash; React</h2>

<pre><code>import { useResource } from "@predictor-foundation/graphql-client/react";

function Event({ url, id }: { url: string; id: string }) {
	const resource = useResource(fetchEvent, [url, id]);

	switch (resource.status) {
		case "loading":
			return &lt;Spinner /&gt;;
		case "error":
			return &lt;Error message={resource.error.message} /&gt;;
		case "notFound":
			return &lt;NotFound /&gt;;
		case "ready":
			return &lt;EventCard event={resource.data} /&gt;;
	}
}
</code></pre>

<h2>Errors</h2>

<p>
	Every failure <code>fetchGraphql</code> throws extends
	<code>NonFatalError</code>: <code>NetworkError</code> (transport rejected),
	<code>FetchError</code> (non-OK HTTP status), <code>DataError</code>
	(GraphQL <code>errors</code> with no <code>data</code>). The React hooks
	treat any thrown value that is <em>not</em> a <code>NonFatalError</code> as
	fatal and rethrow it to the nearest error boundary, so the <code>error</code>
	state always holds a <code>NonFatalError</code>.
</p>
