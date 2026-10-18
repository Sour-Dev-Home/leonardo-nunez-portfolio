// A project with its own world gets a cover here, keyed by its slug.
import SatisCover from "./satis/Cover.astro";

export const covers: Record<string, typeof SatisCover> = { "satisfactory-dash": SatisCover };
