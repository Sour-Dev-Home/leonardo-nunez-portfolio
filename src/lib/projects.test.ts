import { describe, it, expect } from "vitest";
import { projectSchema, hasCaseStudy, toProjects, type ProjectData } from "./projects";

const valid = { name: "P", description: "D", status: "shipped", stack: ["TS"], order: 1 };

function data(over: Partial<ProjectData> = {}): ProjectData {
  return { name: "P", description: "D", status: "shipped", stack: ["TS"], order: 1, world: false, ...over };
}

describe("projectSchema", () => {
  it("accepts a minimal project and defaults world to false", () => {
    expect(projectSchema.parse(valid).world).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(() => projectSchema.parse({ ...valid, status: "done" })).toThrow();
  });

  it("rejects a repoUrl that isn't a URL", () => {
    expect(() => projectSchema.parse({ ...valid, repoUrl: "github.com/x" })).toThrow();
  });

  it("rejects an empty stack", () => {
    expect(() => projectSchema.parse({ ...valid, stack: [] })).toThrow();
  });

  it("rejects an ogImage that isn't a root-relative path", () => {
    expect(() => projectSchema.parse({ ...valid, ogImage: "og.png" })).toThrow();
    expect(projectSchema.parse({ ...valid, ogImage: "/og.png" }).ogImage).toBe("/og.png");
  });
});

describe("hasCaseStudy", () => {
  it("is false with no body or a whitespace-only body", () => {
    expect(hasCaseStudy({})).toBe(false);
    expect(hasCaseStudy({ body: "  \n\t" })).toBe(false);
  });

  it("is true when the body has content", () => {
    expect(hasCaseStudy({ body: "## The problem" })).toBe(true);
  });
});

describe("toProjects", () => {
  it("sorts by order", () => {
    const result = toProjects([
      { id: "b", data: data({ name: "B", order: 2 }) },
      { id: "a", data: data({ name: "A", order: 1 }) },
    ]);
    expect(result.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("breaks order ties by name so the home page order is stable", () => {
    const result = toProjects([
      { id: "z", data: data({ name: "Zeta", order: 1 }) },
      { id: "a", data: data({ name: "Alpha", order: 1 }) },
    ]);
    expect(result.map((p) => p.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("sets a slug only for projects with a case study", () => {
    const [withBody, withoutBody] = toProjects([
      { id: "with-body", body: "## Hi", data: data({ order: 1 }) },
      { id: "no-body", body: "", data: data({ order: 2 }) },
    ]);
    expect(withBody.slug).toBe("with-body");
    expect(withoutBody.slug).toBeUndefined();
  });
});
