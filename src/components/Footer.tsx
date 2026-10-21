// Rendered at build time (Shell.astro, no client directive), so the year is the build's year: read once here,
// not during render.
const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer page">
      <p>
        &copy; {YEAR} Leonardo Nunez ·{' '}
        <a href="https://github.com/Sour-Dev-Home/leonardo-nunez-portfolio">
          Source on GitHub
        </a>
      </p>
    </footer>
  );
}
