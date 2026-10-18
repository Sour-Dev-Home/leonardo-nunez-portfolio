/** Runs `load` once, the first time `el` comes near the viewport. */
export function whenVisible(el: Element, load: () => void): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        load();
      }
    },
    { rootMargin: "200px" },
  );
  io.observe(el);
  return () => io.disconnect();
}
