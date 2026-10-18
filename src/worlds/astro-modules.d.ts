// `tsc` alone doesn't know .astro files (Astro's own checker does), and Astro ships no declaration
// for them, so a .ts module that imports a component (index.ts) needs this one.
declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  const Component: AstroComponentFactory;
  export default Component;
}
