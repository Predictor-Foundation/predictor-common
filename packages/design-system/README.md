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

- **block-explorer** (`@prd/frontend`) - the theme originated here and now consumes the
  package: `src/theme.tsx` re-exports `theme` and `src/index.tsx` imports `styles.css`.
  Its table / chip / toggle-button / tooltip overrides have been folded into this theme,
  so the package is a lossless drop-in.
- **faucet** (`@prd/faucet-frontend`) - consumes this package directly.

This package is the single source of truth for the PRDCTR look; both frontends render
from the same theme + tokens.
