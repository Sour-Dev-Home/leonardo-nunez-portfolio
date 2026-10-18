import type { Project } from "../lib/projects";

interface ProjectLinksProps {
  project: Project;
}

export function ProjectLinks({ project }: ProjectLinksProps) {
  if (!project.repoUrl && !project.liveUrl) {
    return null;
  }

  return (
    <div className="project-links">
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
  );
}
