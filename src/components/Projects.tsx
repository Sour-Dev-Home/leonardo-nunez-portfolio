import { projects } from "../data/projects";

export function Projects() {
  return (
    <section id="projects" className="section">
      <h2>Projects</h2>
      <div className="projects-grid">
        {projects.map((project) => (
          <article key={project.name} className="project-card">
            <div className="project-card-header">
              <h3>{project.name}</h3>
              {project.status === "in-progress" && (
                <span className="badge">In progress</span>
              )}
            </div>
            <p>{project.description}</p>
            <ul className="stack-list">
              {project.stack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
            <div className="project-links">
              <a href={project.repoUrl} target="_blank" rel="noreferrer">
                Repo
              </a>
              {project.liveUrl && (
                <a href={project.liveUrl} target="_blank" rel="noreferrer">
                  Live demo
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
