# @predictor-foundation/ui

App-agnostic React UI components shared across Predictor Foundation frontends,
lifted from the block-explorer. Pairs with
[`@predictor-foundation/design-system`](../design-system) (theme + tokens) - use both
together so components are themed correctly.

## Install

```bash
GITHUB_TOKEN=$(gh auth token) pnpm add @predictor-foundation/ui
```

Peers: `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`,
`react-router-dom` (for `Link`/`ButtonLink`).

## Components

| Export | What |
|---|---|
| `MaterialSymbol` | Material Symbols (Rounded) icon |
| `CopyToClipboardButton` | Copy-to-clipboard icon button with "Copied" tooltip |
| `Spinner` / `Loading` | Theme-coloured spinner + centred loading wrapper |
| `Card` / `CardHeader` / `CardRow` | Card layout primitives |
| `Link` / `ButtonLink` | Router-or-anchor link, and a button that navigates |
| `Time` | Absolute / relative / UTC timestamp with optional tooltip |
| `Currency` | Token amount with optional USD conversion + full-precision tooltip |
| `formatNumber` / `formatCurrency` / `getOptimalDecimalPlaces` | Number/currency formatting helpers |

```tsx
import { Card, CopyToClipboardButton, Link } from "@predictor-foundation/ui";

<Card>
	<Link to="/somewhere">Go</Link>
	<CopyToClipboardButton value={address} />
</Card>
```

`Link`/`ButtonLink` require a `react-router-dom` Router in the tree. The icon font for
`MaterialSymbol` ships with `@predictor-foundation/design-system/styles.css`.

## Scope

This is the first, cleanest tier extracted from block-explorer. Higher-tier candidates
(`TabbedContent`, `InfoTable`, `ItemsTable`, `PieChart`, `DateRangePicker`, the table
utilities, and - after decoupling - `ErrorMessage`/`DataViewer`/`NetworkBadge`) can be
added here incrementally.
