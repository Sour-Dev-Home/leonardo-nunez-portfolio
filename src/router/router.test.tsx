import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { RouterProvider, useRouter } from "./Router";
import { Link } from "./Link";
import { matchProjectSlug } from "./matchProjectSlug";

function LocationProbe() {
  const { path } = useRouter();
  return <p data-testid="path">{path}</p>;
}

beforeEach(() => {
  window.history.pushState(null, "", "/");
});

describe("matchProjectSlug", () => {
  it("extracts the slug from a project detail path", () => {
    expect(matchProjectSlug("/projects/satisfactory-dash")).toBe("satisfactory-dash");
  });

  it("returns null for the home path", () => {
    expect(matchProjectSlug("/")).toBeNull();
  });

  it("returns null for an unrelated path", () => {
    expect(matchProjectSlug("/about")).toBeNull();
  });
});

describe("RouterProvider / useRouter", () => {
  it("exposes the current path on mount", () => {
    window.history.pushState(null, "", "/projects/satisfactory-dash");
    render(
      <RouterProvider>
        <LocationProbe />
      </RouterProvider>,
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/projects/satisfactory-dash");
  });

  it("updates path on browser back/forward (popstate)", () => {
    render(
      <RouterProvider>
        <LocationProbe />
      </RouterProvider>,
    );
    window.history.pushState(null, "", "/projects/satisfactory-dash");
    fireEvent.popState(window);
    expect(screen.getByTestId("path")).toHaveTextContent("/projects/satisfactory-dash");
  });

  it("does not push a duplicate history entry when navigating to the current path", () => {
    render(
      <RouterProvider>
        <Link to="/">Home</Link>
      </RouterProvider>,
    );
    const lengthBefore = window.history.length;
    fireEvent.click(screen.getByText("Home"), { button: 0 });
    expect(window.history.length).toBe(lengthBefore);
  });
});

describe("Link", () => {
  it("navigates on a plain left-click without a full page load", () => {
    render(
      <RouterProvider>
        <Link to="/projects/satisfactory-dash">Read case study</Link>
        <LocationProbe />
      </RouterProvider>,
    );
    fireEvent.click(screen.getByText("Read case study"), { button: 0 });
    expect(screen.getByTestId("path")).toHaveTextContent("/projects/satisfactory-dash");
    expect(window.location.pathname).toBe("/projects/satisfactory-dash");
  });

  it("does not intercept a modified click (lets the browser open a new tab)", () => {
    render(
      <RouterProvider>
        <Link to="/projects/satisfactory-dash">Read case study</Link>
        <LocationProbe />
      </RouterProvider>,
    );
    fireEvent.click(screen.getByText("Read case study"), { button: 0, metaKey: true });
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });

  it("renders a real anchor with a real href", () => {
    render(
      <RouterProvider>
        <Link to="/projects/satisfactory-dash">Read case study</Link>
      </RouterProvider>,
    );
    expect(screen.getByRole("link", { name: "Read case study" })).toHaveAttribute(
      "href",
      "/projects/satisfactory-dash",
    );
  });
});
