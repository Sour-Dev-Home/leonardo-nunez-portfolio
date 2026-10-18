/** Mounts a figure on whichever of its drawings fits the screen, and remounts once when that changes
 *  (rotating a phone, resizing a window). The other drawing is hidden and left empty. */
export function mountResponsive(root: HTMLElement, mount: (root: HTMLElement) => () => void, query = "(max-width: 40rem)"): () => void {
  const mq = matchMedia(query);
  let unmount: (() => void) | null = null;
  const apply = () => {
    unmount?.();
    const phone = mq.matches;
    root.querySelectorAll<SVGSVGElement>("svg[data-layout]").forEach((s) => s.toggleAttribute("hidden", (s.dataset.layout === "phone") !== phone));
    unmount = mount(root);
  };
  mq.addEventListener("change", apply);
  apply();
  return () => {
    mq.removeEventListener("change", apply);
    unmount?.();
  };
}
