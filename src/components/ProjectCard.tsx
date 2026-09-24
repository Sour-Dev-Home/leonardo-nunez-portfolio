import type { Project } from "../data/projects";
import { StackList } from "./StackList";
import { ProjectLinks } from "./ProjectLinks";

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
      <StackList stack={project.stack} />
      <ProjectLinks project={project} showCaseStudyLink />
    </article>
  );
}
