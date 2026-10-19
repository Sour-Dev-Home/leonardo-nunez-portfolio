import type { Page } from "@playwright/test";

/** Runs a check from src/design/checks in the page, on the element `root` selects (the document when null). The
 *  check travels as source text, which is why those checks reference nothing outside their own bodies. */
export function inPage<A extends unknown[], R>(page: Page, root: string | null, check: (scope: never, ...args: A) => R, ...args: A): Promise<R> {
  return page.evaluate(
    ([src, sel, rest]) => {
      const scope = sel ? document.querySelector(sel)! : document;
      return new Function(`return (${src})`)()(scope, ...rest);
    },
    [String(check), root, args] as const,
  ) as Promise<R>;
}
