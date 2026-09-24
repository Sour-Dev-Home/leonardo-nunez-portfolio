import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useDocumentMeta } from "./useDocumentMeta";

function TestComponent({ title, description }: { title: string; description?: string }) {
  useDocumentMeta(title, description);
  return null;
}

describe("useDocumentMeta", () => {
  beforeEach(() => {
    document.title = "";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "default description");
  });

  it("sets document.title", () => {
    render(<TestComponent title="Page Title" />);
    expect(document.title).toBe("Page Title");
  });

  it("updates the meta description when one is given", () => {
    render(<TestComponent title="Page Title" description="A specific page description" />);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "A specific page description",
    );
  });

  it("leaves the meta description untouched when none is given", () => {
    render(<TestComponent title="Page Title" />);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "default description",
    );
  });
});
