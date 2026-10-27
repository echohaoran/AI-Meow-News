// Moving the page for the reader: their reduced-motion preference, jumps to anchors, and which section of
// the page they are reading.
import { useEffect, useRef, useState } from "react";

/** Whether the reader asked for reduced motion: still drawings, no animations, instant jumps. */
export const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How the page scrolls for the reader: smoothly, or at once under reduced motion. */
export const scrollBehavior = (): ScrollBehavior => (reducedMotion() ? "auto" : "smooth");

/** Where an anchor stops after a jump: its scroll margin below the window's top. */
const landing = (el: Element) => parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
let releaseAnchor: (() => void) | null = null;

/**
 * Scrolls an anchor to the top (its scroll margin keeps it clear of the bar) and puts it in the address
 * without a new history entry: back still leaves the page for the one it came from, at its position.
 */
export function scrollToAnchor(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  releaseAnchor?.();
  // A long jump loads pictures above its destination. Follow their layout changes until the
  // reader interacts again, otherwise the selected section can end up several screens away.
  let height = document.body.getBoundingClientRect().height;
  const resized = new ResizeObserver(() => {
    if (!target.isConnected) return release();
    const next = document.body.getBoundingClientRect().height;
    if (next === height) return;
    height = next;
    window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - landing(target), behavior: "instant" });
  });
  const interactions = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const release = () => {
    resized.disconnect();
    for (const event of interactions) window.removeEventListener(event, release, true);
    window.removeEventListener("popstate", release);
    document.removeEventListener("visibilitychange", release);
    releaseAnchor = null;
  };
  releaseAnchor = release;
  resized.observe(document.body);
  for (const event of interactions) window.addEventListener(event, release, { capture: true, passive: true });
  window.addEventListener("popstate", release);
  document.addEventListener("visibilitychange", release);
  target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  history.replaceState(history.state, "", `${location.pathname}${location.search}#${id}`);
}

/**
 * The section being read, followed while `watch` is on: the last of `ids` whose start has reached its
 * landing, so a jump to a section marks it. Several short sections can share the bottom of the page: there
 * the one just jumped to is marked (scrolling away forgets it), or else the last. `go` jumps to a section.
 */
export function useCurrentSection(ids: string[], watch = true): [string | null, (id: string) => void] {
  const [current, setCurrent] = useState<string | null>(null);
  const jumped = useRef<{ id: string; landed: boolean } | null>(null);
  const key = ids.join(" ");
  useEffect(() => {
    if (!watch) return;
    const sections = key.split(" ");
    const update = () => {
      let at: string | null = null;
      for (const id of sections) {
        const el = document.getElementById(id);
        // Fractional positions need one pixel of tolerance.
        if (el && el.getBoundingClientRect().top <= landing(el) + 1) at = id;
      }
      const bottom = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (bottom) {
        at = jumped.current?.id ?? sections.at(-1)!;
        if (jumped.current) jumped.current.landed = true;
      } else if (jumped.current?.landed) jumped.current = null;
      setCurrent(at);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const resized = new ResizeObserver(update);
    resized.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resized.disconnect();
    };
  }, [key, watch]);
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const destination = window.scrollY + el.getBoundingClientRect().top - landing(el);
    jumped.current = destination >= max - 1 ? { id, landed: false } : null;
    setCurrent(id);
    scrollToAnchor(id);
  };
  return [current, go];
}
