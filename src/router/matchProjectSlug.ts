export function matchProjectSlug(path: string): string | null {
  const match = /^\/projects\/([a-z0-9-]+)\/?$/.exec(path);
  return match ? match[1] : null;
}
