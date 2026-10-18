import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "./Header";

describe("Header", () => {
  it("links to the work and contact sections from any page, and to the About page", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("href", "/#work");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/#contact");
  });

  it("links the brand back to home, scrolling to top on a same-document navigation", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Leonardo Nunez" })).toHaveAttribute("href", "/#top");
  });
});
