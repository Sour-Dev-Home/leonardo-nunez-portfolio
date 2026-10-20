export const PAGES = [
  { name: "home", path: "/", status: 200 },
  { name: "case-study", path: "/projects/satisfactory-dash", status: 200 },
  { name: "lanes", path: "/projects/lanes", status: 200 },
  { name: "site", path: "/projects/leonardonunez-dev", status: 200 },
  { name: "about", path: "/about", status: 200 },
  { name: "kit", path: "/kit", status: 200 },
  { name: "not-found", path: "/no-such-page", status: 404 },
];

// A pull request runs only the tests for the pages whose built output it changes
// (scripts/e2e-select.ts). Tests in the per-page loops carry this tag; every other
// spec is listed in SPECS.
export const pageTag = (name: string) => `@page:${name}`;

// The pages each spec visits. "tagged": every test in it has a pageTag. []: it
// visits no built page and runs whenever any page changed. A spec missing here
// fails scripts/e2e-select.test.ts.
export const SPECS: Record<string, readonly string[] | "tagged"> = {
  "a11y.spec.ts": "tagged",
  "checks.spec.ts": [],
  "figures.spec.ts": ["kit", "case-study"],
  "fonts.spec.ts": "tagged",
  "frames.spec.ts": ["case-study"],
  "header.spec.ts": ["home", "about"],
  "lanes-figure.spec.ts": ["kit"],
  "machine-states.spec.ts": ["case-study"],
  "layout.spec.ts": "tagged",
  "loading-helpers.spec.ts": [],
  "loading.spec.ts": "tagged",
  "prerender.spec.ts": ["home", "case-study"],
  "sidenote.spec.ts": ["kit"],
  "site-figure.spec.ts": ["site"],
  "visual.spec.ts": "tagged",
  "work.spec.ts": ["home"],
};
