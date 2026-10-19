import { describe, expect, it } from "vitest";
import * as checks from "./checks";

// e2e sends each check into the page as source text, so a check must work from its own source alone.
const fromSource = <F>(fn: F): F => new Function(`return (${String(fn)})`)() as F;

describe("the shared checks", () => {
  it("each compiles from its own source", () => {
    for (const fn of [checks.labelCollisions, checks.titleGap, checks.overflowX, checks.mediaBoxes]) {
      expect(typeof fromSource(fn)).toBe("function");
    }
  });

  it("overflowX: how far the content is wider than its box", () => {
    expect(fromSource(checks.overflowX)({ scrollWidth: 380, clientWidth: 360 })).toBe(20);
    expect(fromSource(checks.overflowX)({ scrollWidth: 360, clientWidth: 360 })).toBe(0);
  });

  it("labelCollisions finds nothing where there is no drawing", () => {
    expect(fromSource(checks.labelCollisions)(document.createElement("div"))).toEqual([]);
  });

  it("titleGap: the h1's distance from its box's padded left edge", () => {
    const box = document.createElement("div");
    box.style.paddingLeft = "16px";
    const h1 = document.createElement("h1");
    box.append(h1);
    document.body.append(box);
    box.getBoundingClientRect = () => ({ left: 100 }) as DOMRect;
    h1.getBoundingClientRect = () => ({ left: 116 }) as DOMRect;
    expect(fromSource(checks.titleGap)(h1)).toBe(0);
    h1.getBoundingClientRect = () => ({ left: 220 }) as DOMRect;
    expect(fromSource(checks.titleGap)(h1)).toBe(104);
    box.remove();
  });

  it("mediaBoxes: each match's rounded size and source", () => {
    const scope = document.createElement("div");
    scope.innerHTML = '<img src="/a.png"><div class="m-img"></div>';
    const [img, div] = [...scope.children];
    img.getBoundingClientRect = () => ({ width: 99.6, height: 50.2 }) as DOMRect;
    div.getBoundingClientRect = () => ({ width: 10, height: 0 }) as DOMRect;
    expect(fromSource(checks.mediaBoxes)(scope)).toEqual([{ src: "/a.png", width: 100, height: 50 }]);
    expect(fromSource(checks.mediaBoxes)(scope, ".m-img")).toEqual([{ src: "", width: 10, height: 0 }]);
  });
});
