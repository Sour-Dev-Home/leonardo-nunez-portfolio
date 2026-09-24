import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the name and every nav section", () => {
    render(<App />);
    expect(screen.getAllByText(/Leonardo Nunez/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /about/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /skills/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /contact/i })).toBeInTheDocument();
  });

  it("lists at least one project with a working repo link", () => {
    render(<App />);
    const repoLink = screen.getAllByRole("link", { name: /repo/i })[0];
    expect(repoLink).toHaveAttribute("href", expect.stringContaining("github.com"));
  });

  it("renders the project detail page at a /projects/:slug path, with the real generated case-study body", () => {
    window.history.pushState(null, "", "/projects/satisfactory-dash");
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "satisfactory-dash" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "The problem" })).toBeInTheDocument();
    window.history.pushState(null, "", "/");
  });
});
