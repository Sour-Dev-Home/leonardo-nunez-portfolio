export function Hero() {
  return (
    <section id="top" className="hero page reveal">
      <div className="hero-text">
        <p className="kicker">Full-stack developer</p>
        <h1>Leonardo Nunez</h1>
        <p className="hero-lede">
          Full-stack developer with a background in electrical &amp; computer
          engineering from Rice University. I build web applications with the same
          rigor I bring to embedded systems and infrastructure — real tests, real
          deployment, no shortcuts.
        </p>
        <p className="hero-links">
          <a href="#work">See the work ↓</a>
          <a href="#contact">Get in touch →</a>
        </p>
      </div>
      {/* Above the fold, so no lazy loading; width/height reserve its 4:5 box. */}
      <img
        className="hero-portrait"
        src="/images/portrait.webp"
        alt="Portrait of Leonardo Nunez, smiling, in glasses"
        width={720}
        height={900}
        fetchPriority="high"
      />
    </section>
  );
}
