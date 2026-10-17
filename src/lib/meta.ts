export const DEFAULT_OG_IMAGE = "/og/default.png";

export interface MetaInput {
  title: string;
  description: string;
  /** Root-relative path of the page, e.g. "/projects/satisfactory-dash". */
  path: string;
  /** Root-relative path of the preview image; defaults to DEFAULT_OG_IMAGE. */
  image?: string;
}

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface Meta {
  title: string;
  canonical: string;
  tags: MetaTag[];
}

// Link previewers (LinkedIn, Slack) don't run JavaScript and ignore relative URLs,
// so every URL here is absolute and the tags are rendered at build time.
export function buildMeta(input: MetaInput, site: URL | string): Meta {
  const canonical = new URL(input.path, site).href;
  const image = new URL(input.image ?? DEFAULT_OG_IMAGE, site).href;
  return {
    title: input.title,
    canonical,
    tags: [
      { name: "description", content: input.description },
      { property: "og:type", content: input.path === "/" ? "website" : "article" },
      { property: "og:site_name", content: "Leonardo Nunez" },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
