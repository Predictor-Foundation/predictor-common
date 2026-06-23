import type { HTMLAttributes } from "react";

export type MaterialSymbolProps = HTMLAttributes<HTMLSpanElement> & {
	name: string;
};

/** A Material Symbols (Rounded) icon. Requires the font, shipped by the design system's styles.css. */
export const MaterialSymbol = ({ name, ...props }: MaterialSymbolProps) => (
	<span className="material-symbols-rounded" aria-hidden {...props}>
		{name}
	</span>
);
