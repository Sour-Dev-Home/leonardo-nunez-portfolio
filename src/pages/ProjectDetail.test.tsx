import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RouterProvider } from "../router/Router";
import { ProjectDetail } from "./ProjectDetail";

vi.mock("../content/case-studies", () => ({
  getCaseStudyHtml: (slug: string) =>
    slug === "satisfactory-dash" ? "<h2>The problem</h2><p>Test body.</p>" : null,
}));

function renderDetail(slug: string) {
  return render(
    <RouterProvider>
      <ProjectDetail slug={slug} />
    </RouterProvider>,
  );
}

describe("ProjectDetail", () => {
  it("renders the project name as the page's h1", () => {
    renderDetail("satisfactory-dash");
    expect(screen.getByRole("heading", { level: 1, name: "satisfactory-dash" })).toBeInTheDocument();
  });

  it("renders the generated case-study HTML body", () => {
    renderDetail("satisfactory-dash");
    expect(screen.getByRole("heading", { level: 2, name: "The problem" })).toBeInTheDocument();
    expect(screen.getByText("Test body.")).toBeInTheDocument();
  });

  it("renders a working link back home", () => {
    renderDetail("satisfactory-dash");
    const backLink = screen.getByRole("link", { name: /back to all projects/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("renders a not-found state for an unknown slug, with no h1 mismatch", () => {
    renderDetail("does-not-exist");
    expect(screen.getByRole("heading", { level: 1, name: /not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute("href", "/");
  });
});
