# @predictor-foundation/design-system

The shared **PRDCTR** look and feel: design tokens + a Material-UI theme, dark-native
with the lime `#d9fe42` accent and the Syne / Inter / DM Mono type ramp. Lifted from
the block-explorer frontend so every Predictor Foundation frontend renders identically.

## Install

```bash
GITHUB_TOKEN=$(gh auth token) pnpm add @predictor-foundation/design-system
```

Requires peers: `react`, `@mui/material`, `@emotion/react`, `@emotion/styled`.

## Use

```tsx
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "@predictor-foundation/design-system";
import "@predictor-foundation/design-system/styles.css"; // font imports + body reset

createRoot(el).render(
	<ThemeProvider theme={theme}>
		<CssBaseline />
		<App />
	</ThemeProvider>,
);
```

Importing the package also applies the MUI/Emotion module augmentations (the custom
`neutral` palette colour and the Emotion `css` theme typing), so `color="neutral"` and
themed `css` callbacks are type-safe with zero extra setup.

## Exports

- `theme` - the Material-UI theme.
- `predictorTokens` - the raw colour tokens (`primary`, `background`, `card`, …).
- `fontFamilies` - the display / body / mono font stacks.
- `@predictor-foundation/design-system/styles.css` - Google-Fonts imports + body reset.

## Consumers

- **faucet** (`@prd/faucet-frontend`) - consumes this package directly.
- **block-explorer** - the theme originated here; it can adopt the package by replacing
  its local `src/theme.tsx` with a re-export. Its extra component overrides
  (tables, chips, toggle buttons, tooltips) should be merged into this theme as part of
  that migration so it stays the single source of truth.
