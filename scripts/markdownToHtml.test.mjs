import { describe, it, expect } from "vitest";
import { markdownToHtml } from "./markdownToHtml.mjs";

describe("markdownToHtml", () => {
  it("converts a heading and paragraph", () => {
    const html = markdownToHtml("## Hello\n\nWorld.");
    expect(html).toContain("<h2>Hello</h2>");
    expect(html).toContain("<p>World.</p>");
  });

  it("passes raw HTML through untouched (needed for the accessible diagram block)", () => {
    const html = markdownToHtml('<details>\n<summary>More</summary>\n<p>Detail.</p>\n</details>');
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>More</summary>");
  });

  it("converts a markdown image to a plain img tag", () => {
    const html = markdownToHtml("![alt text](/diagrams/example.svg)");
    expect(html).toContain('<img src="/diagrams/example.svg" alt="alt text">');
  });
});
