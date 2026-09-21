const SECTIONS = ["about", "projects", "skills", "contact"] as const;

export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top">
        Leonardo Nunez
      </a>
      <nav>
        {SECTIONS.map((id) => (
          <a key={id} href={`#${id}`}>
            {id[0].toUpperCase() + id.slice(1)}
          </a>
        ))}
      </nav>
    </header>
  );
}
