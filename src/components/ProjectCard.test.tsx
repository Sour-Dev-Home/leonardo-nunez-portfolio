import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RouterProvider } from "../router/Router";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "../data/projects";

const baseProject: Project = {
  name: "Test Project",
  description: "A project for testing.",
  status: "shipped",
  stack: ["React", "TypeScript"],
  repoUrl: "https://github.com/example/test-project",
};

function renderCard(project: Project) {
  return render(
    <RouterProvider>
      <ProjectCard project={project} />
    </RouterProvider>,
  );
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

  it("does not apply the compact class by default", () => {
    const { container } = renderCard(baseProject);
    expect(container.querySelector(".project-card-compact")).not.toBeInTheDocument();
  });
});
