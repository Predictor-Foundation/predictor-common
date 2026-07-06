import { Button, type ButtonProps } from "@mui/material";
import { Link, type LinkProps } from "./Link";

export type ButtonLinkProps = ButtonProps & LinkProps;

/** A button that navigates - composes {@link Link} with MUI Button. */
export const ButtonLink = (props: ButtonLinkProps) => <Button component={Link} {...props} />;
