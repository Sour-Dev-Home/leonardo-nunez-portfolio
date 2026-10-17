import type { Project } from "../lib/projects";

interface ProjectLinksProps {
  project: Project;
  showCaseStudyLink?: boolean;
}

export function ProjectLinks({ project, showCaseStudyLink = false }: ProjectLinksProps) {
  const hasCaseStudyLink = showCaseStudyLink && !!project.slug;

  if (!project.repoUrl && !project.liveUrl && !hasCaseStudyLink) {
    return null;
  }

  return (
    <div className="project-links">
      {hasCaseStudyLink && <a href={`/projects/${project.slug}`}>Read case study →</a>}
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
