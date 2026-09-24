import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "./Header";

describe("Header", () => {
  it("uses root-relative hrefs so section links still resolve from a non-home page", () => {
    render(<Header />);
    for (const name of ["About", "Projects", "Skills", "Contact"]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toMatch(/^\/#/);
    }
  });

  it("links the brand back to home, scrolling to top on a same-document navigation", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Leonardo Nunez" })).toHaveAttribute("href", "/#top");
  });
});
