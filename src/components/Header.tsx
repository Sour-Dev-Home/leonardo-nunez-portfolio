const NAV = [
  { label: "Work", href: "/#work" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/#contact" },
];

/** `current` is the page's path; the nav link to that page is marked as the current one. */
export function Header({ current }: { current?: string }) {
  return (
    <header className="site-header page">
      <a className="brand" href="/#top">
        Leonardo Nunez
      </a>
      <nav className="site-nav" aria-label="Main">
        {NAV.map(({ label, href }) => (
          <a key={label} href={href} aria-current={href === current ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
