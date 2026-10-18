/** Mounts a figure on whichever of its drawings fits the screen, and remounts once when that changes
 *  (rotating a phone, resizing a window). The other drawing is hidden and left empty. `kept` outlives
 *  each mount: a figure writes the reader's state into it (a step, a toggle, a pause) and reads it back on
 *  the next mount, so rotating a phone doesn't start the figure over. */
export function mountResponsive<K extends object>(
  root: HTMLElement,
  mount: (root: HTMLElement, kept: Partial<K>) => () => void,
  query = "(max-width: 40rem)",
): () => void {
  const mq = matchMedia(query);
  const kept: Partial<K> = {};
  let unmount: (() => void) | null = null;
  const apply = () => {
    unmount?.();
    const phone = mq.matches;
    root.querySelectorAll<SVGSVGElement>("svg[data-layout]").forEach((s) => s.toggleAttribute("hidden", (s.dataset.layout === "phone") !== phone));
    unmount = mount(root, kept);
  };
  mq.addEventListener("change", apply);
  apply();
  return () => {
    mq.removeEventListener("change", apply);
    unmount?.();
  };
}
