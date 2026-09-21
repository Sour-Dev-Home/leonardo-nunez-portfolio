const LINKEDIN_URL = "https://www.linkedin.com/in/leonardo-nunez-708634248";

export function Contact() {
  return (
    <section id="contact" className="section">
      <h2>Contact</h2>
      <p>Open to full-stack developer roles — reach out any of these ways.</p>
      <ul className="contact-list">
        <li>
          <a href="mailto:soure393@gmail.com">soure393@gmail.com</a>
        </li>
        <li>
          <a href="https://github.com/SourE-dev" target="_blank" rel="noreferrer">
            github.com/SourE-dev
          </a>
        </li>
        <li>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </li>
      </ul>
    </section>
  );
}
