import type { Project } from "../lib/projects";
import { StackList } from "./StackList";
import { ProjectLinks } from "./ProjectLinks";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isCompact = project.emphasis === "secondary";
  const classes = ["work-card", "project-card", isCompact && "project-card-compact"].filter(Boolean).join(" ");

  return (
    <article className={classes}>
      <div className="work-card-still" aria-hidden="true">
        {project.ogImage ? (
          <img src={project.ogImage} alt="" width={1200} height={630} decoding="async" />
        ) : (
          <span className="work-card-type">{project.name}</span>
        )}
      </div>
      <div className="work-card-body">
        <div className="project-card-header">
          <h3>{project.name}</h3>
          {project.status === "in-progress" && <span className="badge">In progress</span>}
        </div>
        <p>{project.description}</p>
        <StackList stack={project.stack} />
        <ProjectLinks project={project} showCaseStudyLink />
      </div>
    </article>
  );
}
