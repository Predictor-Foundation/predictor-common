/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import type { HTMLAttributes } from "react";
import { Spinner } from "./Spinner";

const loadingStyle = css`
	display: flex;
	align-items: center;
	justify-content: center;
`;

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {}

/** Centres a {@link Spinner} - drop in while data loads. */
export const Loading = (props: LoadingProps) => (
	<div {...props} css={loadingStyle}>
		<Spinner />
	</div>
);
