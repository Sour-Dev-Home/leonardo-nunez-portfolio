import { projects } from "../data/projects";
import { getCaseStudyHtml } from "../content/case-studies";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Link } from "../router/Link";

interface ProjectDetailProps {
  slug: string;
}

export function ProjectDetail({ slug }: ProjectDetailProps) {
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    return (
      <>
        <Header />
        <main>
          <section className="section">
            <h1>Project not found</h1>
            <p>
              <Link to="/">Back home</Link>
            </p>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const html = getCaseStudyHtml(slug) ?? "";

  return (
    <>
      <Header />
      <main>
        <article className="section case-study">
          <p className="case-study-back">
            <Link to="/">← Back to all projects</Link>
          </p>
          <h1>{project.name}</h1>
          <ul className="stack-list">
            {project.stack.map((tech) => (
              <li key={tech}>{tech}</li>
            ))}
          </ul>
          {(project.repoUrl || project.liveUrl) && (
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
          )}
          {/* eslint-disable-next-line react/no-danger -- content is our own build-time-generated HTML, never user input */}
          <div className="case-study-body" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </main>
      <Footer />
    </>
  );
}
