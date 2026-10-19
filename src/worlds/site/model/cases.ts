// The bugs the "Where it breaks" figure can inject. Each names the e2e test that guards against it, by its exact
// title, and whether the gate caught it (#40), missed it and then gained a test (#38), or guarded it from the start.

export const WIDTHS = [360, 390, 768, 1280] as const;
export type Width = (typeof WIDTHS)[number];
export type CaseId = "fonts" | "hero" | "media" | "line";
export type Verdict = "caught" | "missed" | "guarded";

export interface Case {
  id: CaseId;
  /** The switch's text. */
  label: string;
  verdict: Verdict;
  pr?: number;
  test: { file: string; title: string };
  failsAt: readonly Width[];
  /** The caption while it fails, and after Fix it. */
  bug: string;
  fix: string;
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  caught: "caught by CI",
  missed: "missed, then tested",
  guarded: "guarded",
};

export const CASES: readonly Case[] = [
  {
    id: "fonts",
    label: "CI's wider fonts",
    verdict: "caught",
    pr: 40,
    test: { file: "e2e/figures.spec.ts", title: "no line crosses a label at any step or mid-switch" },
    failsAt: [768],
    bug: "CI's fonts set the label wider, and on tablets the route crosses it.",
    fix: "The route climbs clear of the label, as in #40.",
  },
  {
    id: "hero",
    label: "A grid for one hero",
    verdict: "missed",
    pr: 38,
    test: { file: "e2e/layout.spec.ts", title: "the page title starts at the left edge of the content" },
    failsAt: [768, 1280],
    bug: "A grid meant for the home page's portrait splits the kicker and the title into two columns.",
    fix: "The grid applies only to a header with a portrait, as in #38.",
  },
  {
    id: "media",
    label: "No reserved space",
    verdict: "guarded",
    test: { file: "e2e/loading.spec.ts", title: "media keeps its size and nothing moves while it loads" },
    failsAt: [360, 390, 768, 1280],
    bug: "The picture has no height until it loads, then pushes the text down.",
    fix: "The picture reserves its space before it loads.",
  },
  {
    id: "line",
    label: "A long line",
    verdict: "guarded",
    test: { file: "e2e/layout.spec.ts", title: "has no horizontal page scroll" },
    failsAt: [360],
    bug: "A code line is wider than a 360 px screen, so the whole page scrolls sideways.",
    fix: "The code line scrolls inside its own box.",
  },
];

/** "Fails at 768 and 1280 px. CI's test “…”: <detail>." */
export function failureText(c: Case, widths: readonly Width[], detail: string): string {
  const list = widths.length > 1 ? `${widths.slice(0, -1).join(", ")} and ${widths.at(-1)}` : String(widths[0]);
  return `Fails at ${list} px. CI's test “${c.test.title}”: ${detail}.`;
}
