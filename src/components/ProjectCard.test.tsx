import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "../lib/projects";

const baseProject: Project = {
  name: "Test Project",
  summary: "A test project.",
  description: "A project for testing.",
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
  it("renders the name, description, and stack chips", () => {
    renderCard(baseProject);
    expect(screen.getByRole("heading", { name: "Test Project" })).toBeInTheDocument();
    expect(screen.getByText("A project for testing.")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("shows a case-study link only when a slug is present", () => {
    renderCard(baseProject);
    expect(screen.queryByText(/read case study/i)).not.toBeInTheDocument();

    renderCard({ ...baseProject, slug: "test-project" });
    const link = screen.getByRole("link", { name: /read case study/i });
    expect(link).toHaveAttribute("href", "/projects/test-project");
  });

  it("applies a compact class when emphasis is secondary", () => {
    const { container } = renderCard({ ...baseProject, emphasis: "secondary" });
    expect(container.querySelector(".project-card-compact")).toBeInTheDocument();
  });

  it("shows the project's still when it has one, with empty alt text (decorative)", () => {
    const { container } = renderCard({ ...baseProject, ogImage: "/demo/poster.png" });
    const img = container.querySelector(".work-card-still img");
    expect(img).toHaveAttribute("src", "/demo/poster.png");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("width");
  });

  it("falls back to a typographic still without an image", () => {
    const { container } = renderCard(baseProject);
    expect(container.querySelector(".work-card-type")?.textContent).toBe("Test Project");
  });

  it("does not apply the compact class by default", () => {
    const { container } = renderCard(baseProject);
    expect(container.querySelector(".project-card-compact")).not.toBeInTheDocument();
  });
});
