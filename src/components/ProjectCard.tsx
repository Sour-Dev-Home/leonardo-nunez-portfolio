import type { Project } from "../data/projects";
import { Link } from "../router/Link";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isCompact = project.emphasis === "secondary";

  return (
    <article className={isCompact ? "project-card project-card-compact" : "project-card"}>
      <div className="project-card-header">
        <h3>{project.name}</h3>
        {project.status === "in-progress" && <span className="badge">In progress</span>}
      </div>
      <p>{project.description}</p>
      <ul className="stack-list">
        {project.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
      {(project.repoUrl || project.liveUrl || project.slug) && (
        <div className="project-links">
          {project.slug && <Link to={`/projects/${project.slug}`}>Read case study →</Link>}
          {project.repoUrl && (
            <a href={project.repoUrl} target="_blank" rel="noreferrer">
              Repo
            </a>
          )}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer">
              Live demo
            </a>
          )}
        </div>
      )}
    </article>
  );
}
