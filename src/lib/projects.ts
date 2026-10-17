import { z } from "astro/zod";

// The shape of every project's frontmatter in src/content/projects/<slug>/index.md.
// src/content.config.ts uses this schema, so an invalid entry fails the build.
export const projectSchema = z.object({
  name: z.string().min(1),
  // The meta and link-preview description. Search results cut at about 155-160
  // characters, so the full card text (description) is too long for it.
  summary: z.string().min(1).max(160),
  description: z.string().min(1),
  status: z.enum(["in-progress", "shipped"]),
  stack: z.array(z.string().min(1)).min(1),
  repoUrl: z.url().optional(),
  liveUrl: z.url().optional(),
  emphasis: z.enum(["primary", "secondary"]).optional(),
  order: z.number().int(),
  world: z.boolean().default(false),
  ogImage: z.string().startsWith("/").optional(),
});

export type ProjectData = z.infer<typeof projectSchema>;

export interface Project extends ProjectData {
  /** Set only when the project has a case-study page. */
  slug?: string;
}

export interface ProjectEntry {
  id: string;
  body?: string;
  data: ProjectData;
}

export function hasCaseStudy(entry: { body?: string }): boolean {
  return (entry.body ?? "").trim().length > 0;
}

export function toProjects(entries: ProjectEntry[]): Project[] {
  return [...entries]
    .sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name))
    .map((entry) => ({ ...entry.data, slug: hasCaseStudy(entry) ? entry.id : undefined }));
}
