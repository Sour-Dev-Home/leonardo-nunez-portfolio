const modules = import.meta.glob<{ html: string }>("./generated/*.ts", { eager: true });

export function getCaseStudyHtml(slug: string): string | null {
  const mod = modules[`./generated/${slug}.ts`];
  return mod ? mod.html : null;
}
