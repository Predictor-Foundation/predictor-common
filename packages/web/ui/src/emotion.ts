// Makes the Emotion `Theme` (used in `css` prop callbacks) the MUI theme, so
// `theme.palette`/`theme.breakpoints` are typed. Importing this package applies it.
import type {} from "@emotion/react";
import type { Theme as MuiTheme } from "@mui/material";

declare module "@emotion/react" {
	export interface Theme extends MuiTheme {}
}
