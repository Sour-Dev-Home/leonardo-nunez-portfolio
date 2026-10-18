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
      {project.cover && (
        // Decorative: the title already names the project. Every cover gets the
        // same 16:9 slot, so the width/height here only reserve its shape.
        <div className="work-card-media" aria-hidden="true">
          <img
            src={project.cover.src}
            alt=""
            width={1600}
            height={900}
            decoding="async"
            style={project.cover.focus ? { objectPosition: project.cover.focus } : undefined}
          />
        </div>
      )}
      <div className="work-card-body">
        <div className="project-card-header">
          <h3>
            {project.slug ? (
              // Stretched over the whole card in work.css, so a click anywhere opens it.
              <a className="work-card-link" href={`/projects/${project.slug}`}>
                {project.name}
              </a>
            ) : (
              project.name
            )}
          </h3>
          {project.status === "in-progress" && <span className="badge">In progress</span>}
        </div>
        <p className="work-card-summary">{project.summary}</p>
        <StackList stack={project.stack} />
        <ProjectLinks project={project} />
      </div>
    </article>
  );
}
