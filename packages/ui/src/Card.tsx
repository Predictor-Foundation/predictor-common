/** @jsxImportSource @emotion/react */
import { css, type Theme } from "@emotion/react";
import type { HTMLAttributes } from "react";

const cardStyle = (theme: Theme) => css`
	position: relative;
	border-radius: 16px;
	padding: 32px;
	background-color: ${theme.palette.background.paper};
	border: 1px solid ${theme.palette.divider};
	margin: 16px 0;
	box-shadow:
		0px 0.5px 1px rgba(0, 0, 0, 0.2),
		0px 2px 4px rgba(0, 0, 0, 0.25),
		0px 6px 16px rgba(0, 0, 0, 0.35);

	${theme.breakpoints.up("md")} {
		padding: 40px;
	}
`;

const cardHeaderStyle = css`
	display: block;
	padding-bottom: 48px;
	align-items: center;

	font-weight: 700;
	font-size: 20px;
	line-height: 28px;

	word-break: break-all;

	[data-class=copy-button] {
		vertical-align: text-bottom;
		margin: 2px 0;
		margin-left: 16px;
	}
`;

const cardRowStyle = (theme: Theme) => css`
	display: flex;
	flex-direction: row;
	align-items: stretch;
	gap: 16px;
	margin: 16px 0;

	> * {
		flex: 1 1 auto;
	}

	> [data-class=card] {
		margin: 0;
	}

	${theme.breakpoints.down("lg")} {
		flex-direction: column;
	}
`;

export const Card = (props: HTMLAttributes<HTMLDivElement>) => (
	<div css={cardStyle} data-class="card" {...props} />
);

export const CardHeader = (props: HTMLAttributes<HTMLDivElement>) => (
	<div css={cardHeaderStyle} data-class="card-header" {...props} />
);

export const CardRow = (props: HTMLAttributes<HTMLDivElement>) => (
	<div css={cardRowStyle} data-class="card-row" {...props} />
);
