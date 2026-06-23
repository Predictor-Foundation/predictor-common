import { Link as MuiLink, type LinkProps as MuiLinkProps } from "@mui/material";
import { type AnchorHTMLAttributes, forwardRef } from "react";
import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom";

export interface LinkProps extends Omit<RouterLinkProps, "to"> {
	to?: RouterLinkProps["to"];
	href?: AnchorHTMLAttributes<HTMLAnchorElement>["href"];
}

/** A link that routes internally when given `to`, or is a plain anchor when given `href`. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
	const { href, to, ...restProps } = props;
	const linkProps: MuiLinkProps = { ...restProps, underline: "none" };

	if (to) {
		return <MuiLink ref={ref} component={RouterLink} to={to} {...linkProps} />;
	}
	return <MuiLink href={href} {...linkProps} />;
});

Link.displayName = "Link";
