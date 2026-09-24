import { projects } from "../data/projects";
import { getCaseStudyHtml } from "../content/case-studies";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { StackList } from "../components/StackList";
import { ProjectLinks } from "../components/ProjectLinks";
import { Link } from "../router/Link";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

interface ProjectDetailProps {
  slug: string;
}

export function ProjectDetail({ slug }: ProjectDetailProps) {
  const project = projects.find((p) => p.slug === slug);
  useDocumentMeta(
    project
      ? `${project.name} — Case Study | Leonardo Nunez`
      : "Project not found | Leonardo Nunez",
    project?.description,
  );

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
          <StackList stack={project.stack} />
          <ProjectLinks project={project} />
          {/* eslint-disable-next-line react/no-danger -- content is our own build-time-generated HTML, never user input */}
          <div className="case-study-body" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </main>
      <Footer />
    </>
  );
}
