const NAV = [
  { label: "Work", href: "/#work" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/#contact" },
];

export function Header() {
  return (
    <header className="site-header page">
      <a className="brand" href="/#top">
        Leonardo Nunez
      </a>
      <nav className="site-nav" aria-label="Main">
        {NAV.map(({ label, href }) => (
          <a key={label} href={href}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
