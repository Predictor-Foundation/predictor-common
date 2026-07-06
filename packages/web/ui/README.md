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

## Utilities

Pure, framework-light helpers shared across the frontends. No hidden global
config: token `decimals` and the SS58 `prefix` are always explicit parameters,
so nothing assumes a single chain or a single token scale.

| Export | Module | What |
|---|---|---|
| `truncateMiddle` | `./truncate` | Collapse the middle of a hash/address (`0x1234…abcdef`); keeps the value if truncating wouldn't shorten it |
| `encodeAddress` / `decodeAddress` / `isEncodedAddress` / `isAccountPublicKey` / `normaliseEthAddress` | `./address` | SS58 + Ethereum address helpers over `@polkadot/util-crypto`; `prefix` is an explicit param, `normaliseEthAddress` is a smart constructor returning `` `0x${string}` \| null `` |
| `upperFirst` / `lowerFirst` / `noCase` / `tryParseInt` | `./string` | Small string helpers |
| `getDateFnsLocaleForLanguageTag` / `getBrowserDateFnsLocale` | `./dateLocale` | BCP 47 language tag to date-fns `Locale`, plus browser-locale detection (for MUI `LocalizationProvider`) |
| `simplifyId` | `./id` | Simplify a hyphen-delimited entity id for display (drop block hash, strip leading zeros); generic over the id shape |
| `parseTokenAmount` / `formatTokenAmount` / `parseTokenAmountErrorMessage` / `MAX_U128` | `./amount` | Human decimal string to/from integer base units in pure `bigint`; `parseTokenAmount` returns a typed `Result` (parse, don't validate), `formatTokenAmount` adds thousands separators and an optional symbol |
| `formatDuration` | `./duration` | Milliseconds to coarse human span (`"24 hours"`, `"5 minutes"`) |

```ts
import { truncateMiddle } from "@predictor-foundation/ui/truncate";
import { isEncodedAddress } from "@predictor-foundation/ui/address";
import { parseTokenAmount, formatTokenAmount } from "@predictor-foundation/ui/amount";

truncateMiddle("0x1234567890abcdef"); // "0x1234…abcdef"

const parsed = parseTokenAmount("1.5", { decimals: 10 });
if (parsed.ok) {
	formatTokenAmount(parsed.value, { decimals: 10, symbol: "PRD" }); // "1.5 PRD"
}
```

The address and amount utilities carry no domain types: they take an SS58
`prefix: number` and a token `decimals: number` directly, rather than an app's
`Network` object, so any frontend can pass its own config in.

```tsx
import { Card, CopyToClipboardButton, Link } from "@predictor-foundation/ui";

<Card>
	<Link to="/somewhere">Go</Link>
	<CopyToClipboardButton value={address} />
</Card>
```

`Link`/`ButtonLink` require a `react-router-dom` Router in the tree. The icon font for
`MaterialSymbol` ships with `@predictor-foundation/design-system/styles.css`.

## Subpath imports

Each component is also exposed on its own subpath, so a consumer can pull in exactly
what it needs without the barrel pulling in unrelated components:

```tsx
import { MaterialSymbol } from "@predictor-foundation/ui/MaterialSymbol";
import { CopyToClipboardButton } from "@predictor-foundation/ui/CopyToClipboardButton";
```

This matters for router-less apps (e.g. the faucet): importing a leaf subpath never
reaches `Link`/`ButtonLink`, so `react-router-dom` is not needed even at build time.
The barrel (`from "@predictor-foundation/ui"`) tree-shakes the same way for bundlers
that support it; the subpaths make the guarantee explicit and bundler-independent.

Available subpaths: `./ButtonLink`, `./Card`, `./CopyToClipboardButton`, `./Currency`,
`./Link`, `./Loading`, `./MaterialSymbol`, `./Spinner`, `./Time`, `./number`, and the
utility modules `./address`, `./amount`, `./dateLocale`, `./duration`, `./id`,
`./string`, `./truncate`. The utility subpaths pull in no React or MUI, so a
non-UI consumer can import just the pure helper it needs.

## Scope

This is the first, cleanest tier extracted from block-explorer. Higher-tier candidates
(`TabbedContent`, `InfoTable`, `ItemsTable`, `PieChart`, `DateRangePicker`, the table
utilities, and - after decoupling - `ErrorMessage`/`DataViewer`/`NetworkBadge`) can be
added here incrementally.

### Deferred component-extraction follow-ups

The pure utilities above are extracted; the following **components** are deliberately
left in their apps for now (each still couples to app state, a `Network` model, or a
wallet provider) and should be extracted in a separate pass:

- **Table family** (block-explorer `src/components/`): `InfoTable`, `ItemsTable`,
  `TablePagination`, `TableSortOptions`, `TableSortToggle`, `TableColumnButton`. These
  share sort/pagination/column state shapes and are the strongest table-component
  candidates. Extraction needs the sort/pagination state modelled as sum types first.
- **Wallet-connect UI** (bridge `src/App.tsx`): the Ethereum connect + Predictor
  (Polkadot extension) connect + account-selector controls (`connectEthereum`,
  `connectPredictor`, the `InjectedAccountWithMeta` selector, connected-wallet
  persistence). Candidate for a shared `WalletConnectButton` / `AccountSelector` once
  decoupled from the bridge's balance/store logic and provider wiring.
- **Status/feedback** (bridge + faucet both hand-roll an `idle | loading | success | error`
  status banner): a shared `StatusMessage` component is a natural companion once the
  status union is unified.
