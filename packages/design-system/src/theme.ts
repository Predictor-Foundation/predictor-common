import { css } from "@emotion/react";
import { alpha, createTheme, darken, lighten } from "@mui/material";
import "./augmentation";
import { fontFamilies, predictorTokens as predictor } from "./tokens";

const customColors = {
	neutral: predictor.mutedForeground,
};

/** The shared PRDCTR Material-UI theme (dark-native, lime accent). */
export const theme = createTheme({
	palette: {
		background: {
			default: predictor.background,
			paper: predictor.card,
		},
		text: {
			primary: predictor.foreground,
			secondary: predictor.mutedForeground,
			disabled: predictor.foregroundDisabled,
		},
		primary: {
			main: predictor.primary,
			contrastText: predictor.primaryForeground,
		},
		secondary: {
			main: predictor.link,
			contrastText: predictor.primaryForeground,
		},
		error: {
			main: predictor.destructive,
			contrastText: "#ffffff",
		},
		warning: {
			main: predictor.warning,
			contrastText: predictor.foreground,
		},
		success: {
			main: predictor.success,
			contrastText: predictor.foreground,
		},
		neutral: {
			main: customColors.neutral,
			dark: darken(customColors.neutral, 0.1),
			light: lighten(customColors.neutral, 0.95),
			contrastText: predictor.foreground,
		},
		divider: predictor.border,
	},
	typography: {
		fontFamily: fontFamilies.body,
		h1: {
			fontFamily: fontFamilies.display,
			fontSize: 20,
			fontWeight: 700,
			lineHeight: "28px",
		},
		h2: {
			fontFamily: fontFamilies.display,
			fontSize: 17,
			fontWeight: 700,
			lineHeight: "24px",
		},
		body1: { fontSize: 15, fontWeight: 400, lineHeight: "20px" },
		body2: { fontSize: 13, fontWeight: 500, lineHeight: "16px" },
		button: {
			fontSize: 17,
			fontWeight: 500,
			lineHeight: "22px",
			letterSpacing: "-0.2px",
			textTransform: "none",
		},
	},
	shape: {
		borderRadius: 8,
	},
	components: {
		MuiCssBaseline: {
			styleOverrides: css`
				body {
					background-color: ${predictor.background};
				}

				.material-symbols-rounded {
					font-family: "Material Symbols Rounded";
					font-weight: 400;
					font-style: normal;
					font-size: 20px;
					line-height: 1;
					letter-spacing: normal;
					text-transform: none;
					display: inline-block;
					white-space: nowrap;
					word-wrap: normal;
					direction: ltr;
					-webkit-font-feature-settings: "liga";
					-webkit-font-smoothing: antialiased;
					font-variation-settings:
						"FILL" 0,
						"wght" 400,
						"GRAD" 0,
						"opsz" 20;
				}
			`,
		},
		MuiLink: {
			styleOverrides: {
				root: css`
					font-weight: 500;
					font-family: ${fontFamilies.body};
					color: ${predictor.link};
					text-decoration-color: transparent;

					&:hover {
						text-decoration-color: currentColor;
					}
				`,
			},
		},
		MuiButton: {
			defaultProps: {
				color: "neutral",
				disableElevation: true,
			},
			styleOverrides: {
				root: css`
					padding: 6px 32px;
					border-radius: 100px;
				`,
				sizeSmall: css`
					padding: 2px 10px;
					font-size: 13px;
					font-weight: 500;
					line-height: 16px;
				`,
				containedPrimary: css`
					background-color: ${predictor.primary};
					color: ${predictor.primaryForeground};

					&:hover {
						background-color: ${alpha(predictor.primary, 0.9)};
					}
				`,
				text: ({ theme, ownerState }) => css`
					${
						ownerState.color &&
						ownerState.color !== "inherit" &&
						css`
							${
								ownerState.size === "small" &&
								css`
									color: ${theme.palette[ownerState.color].dark};
								`
							}

							background-color: ${alpha(theme.palette[ownerState.color].main, 0.075)};

							&:hover {
								background-color: ${alpha(theme.palette[ownerState.color].main, 0.15)};
							}
						`
					}
				`,
			},
		},
		MuiToggleButton: {
			styleOverrides: {
				root: ({ ownerState }) => {
					const color =
						!ownerState.color || ownerState.color === "standard" ? "neutral" : ownerState.color;

					return css`
						padding: 6px 16px;
						color: ${theme.palette.neutral.dark};
						background-color: ${alpha(theme.palette.neutral.main, 0.075)};
						border: none;

						&:hover {
							background-color: ${alpha(theme.palette.neutral.main, 0.15)};
						}

						&.Mui-selected {
							${
								ownerState.size === "small" &&
								css`
									color: ${darken(theme.palette[color].dark, 0.25)};
								`
							}

							background-color: ${alpha(theme.palette[color].main, 0.25)};

							&:hover {
								background-color: ${alpha(theme.palette[color].main, 0.3)};
							}
						}
					`;
				},
				sizeSmall: css`
					padding: 2px 10px;
					font-size: 13px;
					font-weight: 500;
					line-height: 16px;
				`,
			},
		},
		MuiIconButton: {
			styleOverrides: {
				root: css`
					padding: 4px;
					border-radius: 4px;

					svg,
					.material-symbols-rounded {
						display: block;
						font-size: 20px;
					}
				`,
			},
		},
		MuiInputBase: {
			styleOverrides: {
				root: css`
					font-size: 15px;
					color: ${predictor.foreground};
				`,
				input: css`
					height: 24px;
					padding: 12px 16px;
					color: ${predictor.foreground};

					&::placeholder {
						color: ${predictor.foregroundDisabled};
						opacity: 1;
					}
				`,
			},
		},
		MuiOutlinedInput: {
			styleOverrides: {
				root: css`
					border-radius: 8px;
					background-color: ${predictor.card};

					&:hover .MuiOutlinedInput-notchedOutline {
						border-color: ${predictor.border};
					}

					&.Mui-focused {
						box-shadow: 0 0 0 2px ${alpha(predictor.primary, 0.18)};

						.MuiOutlinedInput-notchedOutline {
							border-width: 1px;
							border-color: ${predictor.primary};
						}
					}
				`,
				input: css`
					border-radius: inherit;
					background-color: ${predictor.card};
					height: 24px;
					padding: 12px 16px;
				`,
				notchedOutline: css`
					border-color: ${predictor.border};
				`,
			},
		},
		MuiTableRow: {
			styleOverrides: {
				root: css`
					&:hover {
						background-color: ${alpha("#ffffff", 0.04)};
					}

					&:last-child > .MuiTableCell-body {
						border-bottom: none;
					}
				`,
			},
		},
		MuiTableCell: {
			styleOverrides: {
				root: css`
					font-size: 15px;
					line-height: 20px;
					border-bottom-color: ${predictor.border};
					color: ${predictor.foreground};
				`,
				head: css`
					font-size: 13px;
					font-weight: 500;
					line-height: 16px;
					background-color: ${predictor.muted};
					color: ${predictor.foreground};
				`,
			},
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: css`
					line-height: 20px;
					padding: 8px 12px;
					font-size: 14px;
					color: white;
					background-color: rgba(34, 34, 34, 0.97);
				`,
				arrow: css`
					color: rgba(34, 34, 34, 0.97) !important;
				`,
			},
		},
		MuiChip: {
			styleOverrides: {
				root: css`
					border: none;
					height: auto;
					font-size: 11px;
					line-height: 16px;
					font-weight: 400;
					justify-content: flex-start;
					border-radius: 4px;
				`,
				icon: css`
					margin-left: 0;
					margin-right: -4px;
				`,
				label: css`
					padding-left: 0;
					padding-right: 0;
					white-space: normal;

					.MuiChip-icon + & {
						padding-left: 12px;
					}
				`,
				colorSuccess: css`
					background-color: ${predictor.success};
					color: #000000;
				`,
				colorWarning: css`
					background-color: ${predictor.warning};
					color: #000000;
				`,
				colorError: css`
					background-color: ${predictor.destructive};
					color: #ffffff;
				`,
			},
		},
		MuiAlert: {
			styleOverrides: {
				root: css`
					border-radius: 8px;
					border: 1px solid rgba(236, 33, 39, 0.4);
					background-color: rgba(236, 33, 39, 0.12);
					color: #ff9a9e;
					font-size: 15px;
					line-height: 20px;
					padding: 12px 16px;
				`,
				icon: css`
					color: #ec2127;
					padding: 2px 0;
				`,
				message: css`
					padding: 0;
				`,
			},
		},
	},
});
