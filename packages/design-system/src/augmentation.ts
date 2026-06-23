// Module augmentations for the Predictor design system. Importing this package
// applies them: the custom `neutral` palette colour and the Emotion `css` theme
// callbacks become type-safe in consumers.
import "@emotion/react";
import type { Theme as MuiTheme } from "@mui/material";

declare module "@emotion/react" {
	export interface Theme extends MuiTheme {}
}

declare module "@mui/material/styles" {
	interface Palette {
		neutral: Palette["primary"];
	}
	interface PaletteOptions {
		neutral: PaletteOptions["primary"];
	}
}

declare module "@mui/material/Alert" {
	interface AlertPropsColorOverrides {
		neutral: true;
	}
}

declare module "@mui/material/Button" {
	interface ButtonPropsColorOverrides {
		neutral: true;
	}
}
