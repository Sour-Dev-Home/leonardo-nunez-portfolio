import type { Project } from "../lib/projects";
import { ProjectCard } from "./ProjectCard";

interface ProjectsProps {
  projects: Project[];
}

export function Projects({ projects }: ProjectsProps) {
  return (
    <section id="work" className="section page reveal">
      <div className="section-head">
        <p className="kicker">Selected work</p>
        <h2>Work</h2>
      </div>
      <div className="work-list">
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </section>
  );
}
