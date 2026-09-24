import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useRouter } from "./Router";

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const isModified =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (isModified) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
