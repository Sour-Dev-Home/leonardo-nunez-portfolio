import { describe, it, expect } from "vitest";
import { buildMeta, DEFAULT_OG_IMAGE } from "./meta";

const SITE = "https://example.pages.dev";

function tag(meta: ReturnType<typeof buildMeta>, key: string): string | undefined {
  return meta.tags.find((t) => t.property === key || t.name === key)?.content;
}

describe("buildMeta", () => {
  const home = buildMeta({ title: "Home", description: "Desc", path: "/" }, SITE);
  const page = buildMeta(
    { title: "Case", description: "About it", path: "/projects/x", image: "/img/x.png" },
    SITE,
  );

  it("makes the canonical and og:url absolute", () => {
    expect(page.canonical).toBe("https://example.pages.dev/projects/x");
    expect(tag(page, "og:url")).toBe("https://example.pages.dev/projects/x");
  });

  it("makes og:image absolute, falling back to the default image", () => {
    expect(tag(page, "og:image")).toBe("https://example.pages.dev/img/x.png");
    expect(tag(home, "og:image")).toBe(`https://example.pages.dev${DEFAULT_OG_IMAGE}`);
  });

  it("uses website for the home page and article elsewhere", () => {
    expect(tag(home, "og:type")).toBe("website");
    expect(tag(page, "og:type")).toBe("article");
  });

  it("repeats title and description in the description, og and twitter tags", () => {
    expect(page.title).toBe("Case");
    expect(tag(page, "description")).toBe("About it");
    expect(tag(page, "og:title")).toBe("Case");
    expect(tag(page, "og:description")).toBe("About it");
    expect(tag(page, "twitter:card")).toBe("summary_large_image");
  });

  it("accepts the site as a URL object", () => {
    expect(buildMeta({ title: "T", description: "D", path: "/" }, new URL(SITE)).canonical).toBe(
      "https://example.pages.dev/",
    );
  });
});
