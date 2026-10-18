import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "../lib/projects";

const baseProject: Project = {
  name: "Test Project",
  summary: "A test project.",
  description: "A much longer project description that belongs in the case study.",
  status: "shipped",
  stack: ["React", "TypeScript"],
  repoUrl: "https://github.com/example/test-project",
  order: 1,
  world: false,
};

function renderCard(project: Project) {
  return render(<ProjectCard project={project} />);
}

describe("ProjectCard", () => {
  it("renders the name, the short summary and the stack, not the long description", () => {
    renderCard(baseProject);
    expect(screen.getByRole("heading", { name: "Test Project" })).toBeInTheDocument();
    expect(screen.getByText("A test project.")).toBeInTheDocument();
    expect(screen.queryByText(/much longer/)).not.toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("makes the title the case-study link when there is one, with no separate 'Read' link", () => {
    renderCard({ ...baseProject, slug: "test-project" });
    const link = screen.getByRole("link", { name: /test project/i });
    expect(link).toHaveAttribute("href", "/projects/test-project");
    expect(link).toHaveClass("work-card-link");
    expect(screen.queryByText(/read case study/i)).not.toBeInTheDocument();
  });

  it("leaves the title plain without a case study", () => {
    renderCard(baseProject);
    expect(screen.queryByRole("link", { name: /test project/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repo" })).toBeInTheDocument();
  });

  it("applies a compact class when emphasis is secondary", () => {
    const { container } = renderCard({ ...baseProject, emphasis: "secondary" });
    expect(container.querySelector(".project-card-compact")).toBeInTheDocument();
  });

  it("does not apply the compact class by default", () => {
    const { container } = renderCard(baseProject);
    expect(container.querySelector(".project-card-compact")).not.toBeInTheDocument();
  });

  it("shows the cover in the 16:9 media slot, decorative, at its focus point", () => {
    const { container } = renderCard({ ...baseProject, cover: { src: "/covers/p.webp", focus: "50% 20%" } });
    const img = container.querySelector(".work-card-media img");
    expect(img).toHaveAttribute("src", "/covers/p.webp");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "900");
    expect(img).toHaveStyle({ objectPosition: "50% 20%" });
  });

  it("renders no media slot at all without a cover", () => {
    const { container } = renderCard({ ...baseProject, ogImage: "/og/p.png" });
    expect(container.querySelector(".work-card-media")).not.toBeInTheDocument();
  });
});
