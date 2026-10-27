// The about page's galaxy: real source stars feed an illustrative spiral, and selected signals
// reach the central planet. Arrival keeps the page's existing latest-selection carousel moving.
// The canvas illustrates the process; counts and article links remain real API data.
import { useEffect, useRef, type ReactNode } from "react";
import { withSubject } from "@aihot/site";
import { EDITION } from "../report/format";
import { watchAppearance } from "../../lib/local-state";
import { reducedMotion } from "../../lib/motion";

export interface RiverSource {
  name: string;
  kind: string;
  heatOnly: boolean;
}

const KIND: Record<string, string> = { x_search: "X 账号", rss: "RSS", web_list: "网页", mp_account: "公众号", json_list: "接口" };
const TAU = Math.PI * 2;
const GATE = 0.64;
const FLASH_MS = 900;
type RGB = [number, number, number];
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const smooth = (u: number) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };

function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  angle: number;
  turn: number;
  size: number;
  pass: boolean;
  source: RiverSource;
}
interface Galaxy {
  w: number;
  h: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  radius: number;
  stars: Star[];
  dust: Array<{ x: number; y: number; r: number; alpha: number }>;
}
interface Colors { ink: RGB; accent: RGB; bg: RGB; dark: boolean }
interface Pulse { star: number; progress: number; speed: number }

function layout(w: number, h: number, sources: RiverSource[]): Galaxy {
  const random = prng(20261027 + sources.length);
  const radius = Math.max(24, Math.min(54, h * 0.15, w * 0.085));
  const groups = w >= 900 ? 9 : w >= 560 ? 7 : 5;
  const kept = new Set(Array.from({ length: groups >= 9 ? 3 : 2 }, (_, i) => Math.round((i + 0.5) * groups / (groups >= 9 ? 3 : 2) - 0.5)));
  return {
    w, h, cx: w * 0.5, cy: h * 0.45, rx: w * 0.46, ry: h * 0.43, radius,
    stars: sources.map((source, i) => ({
      angle: i / sources.length * TAU - Math.PI / 2 + (random() - 0.5) * 0.12,
      turn: 1.25 + random() * 0.45,
      size: 1.7 + random() * 1.3,
      pass: kept.has(i % groups) && !source.heatOnly,
      source,
    })),
    dust: Array.from({ length: Math.min(180, Math.round(w / 5)) }, () => ({
      x: random() * w, y: random() * h, r: 0.4 + random() * 0.9, alpha: 0.12 + random() * 0.35,
    })),
  };
}

function position(g: Galaxy, star: Star, progress: number) {
  const t = Math.min(1, Math.max(0, progress));
  const inward = (1 - t) ** 1.15;
  const angle = star.angle + star.turn * smooth(t);
  return {
    x: g.cx + Math.cos(angle) * (g.radius + (g.rx - g.radius) * inward),
    y: g.cy + Math.sin(angle) * (g.radius + (g.ry - g.radius) * inward),
  };
}

function trace(ctx: CanvasRenderingContext2D, g: Galaxy, star: Star, from: number, to: number) {
  ctx.beginPath();
  const steps = Math.max(2, Math.ceil((to - from) * 80));
  for (let i = 0; i <= steps; i++) {
    const p = position(g, star, from + (to - from) * i / steps);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
}

function readColors(probe: CanvasRenderingContext2D): Colors {
  const root = getComputedStyle(document.documentElement);
  const parse = (css: string, fallback: RGB): RGB => {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = `rgb(${fallback.join(",")})`;
    probe.fillStyle = css || probe.fillStyle;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0]!, d[1]!, d[2]!];
  };
  const bg = parse(getComputedStyle(document.body).backgroundColor, [250, 249, 246]);
  return {
    ink: parse(root.getPropertyValue("--ink").trim(), [32, 42, 48]),
    accent: parse(root.getPropertyValue("--accent").trim(), [100, 77, 195]),
    bg, dark: bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11 < 110,
  };
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - radius * 2.1);
  ctx.quadraticCurveTo(x + radius * 0.25, y - radius * 0.25, x + radius * 1.5, y);
  ctx.quadraticCurveTo(x + radius * 0.25, y + radius * 0.25, x, y + radius * 2.1);
  ctx.quadraticCurveTo(x - radius * 0.25, y + radius * 0.25, x - radius * 1.5, y);
  ctx.quadraticCurveTo(x - radius * 0.25, y - radius * 0.25, x, y - radius * 2.1);
  ctx.fill();
}

function orbitParticles(ctx: CanvasRenderingContext2D, r: number, dark: boolean, seconds: number, front: boolean, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996 + seconds * (0.28 + i % 3 * 0.045);
    const a = r * (1.4 + i % 4 * 0.16), b = r * (0.46 + i % 3 * 0.055);
    if ((Math.sin(angle) >= 0) !== front) continue;
    const x = Math.cos(angle) * a, y = Math.sin(angle) * b;
    const alpha = (front ? 0.78 : 0.38) * (0.65 + Math.sin(seconds * 0.8 + i) * 0.25);
    const color: RGB = i % 5 === 0 ? [247, 211, 151] : dark ? [222, 210, 255] : [143, 114, 215];
    ctx.save();
    ctx.shadowBlur = front ? 5 : 2;
    ctx.shadowColor = rgba(color, alpha);
    if (i % 4 === 0) sparkle(ctx, x, y, 1.1, rgba(color, alpha));
    else {
      ctx.beginPath(); ctx.arc(x, y, 0.7 + i % 3 * 0.3, 0, TAU);
      ctx.fillStyle = rgba(color, alpha); ctx.fill();
    }
    ctx.restore();
    if (i % 3 === 0) {
      ctx.beginPath(); ctx.ellipse(0, 0, a, b, 0, angle - 0.12, angle);
      ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(color, alpha * 0.3); ctx.stroke();
    }
  }
}

function planet(ctx: CanvasRenderingContext2D, g: Galaxy, col: Colors, glow: number, seconds: number) {
  const { cx, cy, radius: r } = g;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 2.15);
  halo.addColorStop(0, rgba(col.accent, 0.18 + glow * 0.1));
  halo.addColorStop(1, rgba(col.accent, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.3 + Math.sin(seconds * 0.12) * 0.035);
  // The far half of the planetary rings sits behind the sphere.
  ctx.strokeStyle = rgba(col.accent, col.dark ? 0.45 : 0.3);
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.75, r * 0.48, 0, Math.PI, TAU);
  ctx.stroke();
  const particles = g.w < 560 ? 12 : 18;
  orbitParticles(ctx, r, col.dark, seconds, false, particles);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const sphere = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.08, r * 0.2, r * 0.2, r * 1.25);
  sphere.addColorStop(0, col.dark ? "#e6dcff" : "#e3d9ff");
  sphere.addColorStop(0.35, "#a38be5");
  sphere.addColorStop(0.7, rgba(col.accent, 1));
  sphere.addColorStop(1, col.dark ? "#241749" : "#38225f");
  ctx.fillStyle = sphere;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.lineWidth = r * 0.16;
  for (let i = -2; i <= 2; i++) {
    ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.1)" : "rgba(45,22,92,0.1)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, i * r * 0.3, r * 1.1, r * 0.28, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  // Surface markings move across the lit hemisphere; the light itself stays fixed.
  const rotation = seconds * 0.18;
  for (let i = 0; i < 9; i++) {
    const longitude = rotation + i * TAU / 9, depth = Math.cos(longitude);
    if (depth <= 0) continue;
    const latitude = Math.sin(i * 2.4) * 0.72;
    const x = Math.sin(longitude) * Math.cos(latitude) * r, y = Math.sin(latitude) * r;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.12 + i % 3 * 0.025) * depth, r * 0.035, -0.12, 0, TAU);
    ctx.fillStyle = i % 2 ? `rgba(255,255,255,${depth * 0.17})` : `rgba(45,22,92,${depth * 0.12})`;
    ctx.fill();
  }
  ctx.restore();
  // A thin atmospheric rim, rather than a flat outline around the whole planet.
  const rim = ctx.createLinearGradient(-r, -r, r, r);
  rim.addColorStop(0, "rgba(248,240,255,0.95)");
  rim.addColorStop(0.32, "rgba(208,182,255,0.75)");
  rim.addColorStop(0.62, "rgba(139,103,222,0.1)");
  rim.addColorStop(1, rgba(col.accent, 0.5));
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r * 1.015, 0, TAU);
  ctx.lineWidth = Math.max(1.2, r * 0.035); ctx.strokeStyle = rim;
  ctx.shadowColor = "rgba(190,155,255,0.65)"; ctx.shadowBlur = r * 0.13; ctx.stroke();
  ctx.restore();
  ctx.lineWidth = r * 0.13;
  ctx.strokeStyle = col.dark ? "rgba(208,192,255,0.82)" : "rgba(164,143,220,0.76)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.75, r * 0.48, 0, 0, Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.83, r * 0.56, 0, 0.12, Math.PI - 0.12);
  ctx.stroke();
  orbitParticles(ctx, r, col.dark, seconds, true, particles);
  ctx.restore();
}

function paintStatic(ctx: CanvasRenderingContext2D, g: Galaxy, col: Colors) {
  ctx.clearRect(0, 0, g.w, g.h);
  const nebula = ctx.createRadialGradient(g.cx, g.cy, g.radius, g.cx, g.cy, g.rx);
  nebula.addColorStop(0, rgba(col.accent, col.dark ? 0.1 : 0.055));
  nebula.addColorStop(1, rgba(col.accent, 0));
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, g.w, g.h);
  for (const d of g.dust) {
    ctx.fillStyle = rgba(col.accent, d.alpha * (col.dark ? 0.9 : 0.65));
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate(-0.13);
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, g.rx * (0.24 + i * 0.2), g.ry * (0.24 + i * 0.2), 0, 0, TAU);
    ctx.setLineDash([2, 8]);
    ctx.strokeStyle = rgba(col.accent, col.dark ? 0.16 : 0.12);
    ctx.lineWidth = 0.8; ctx.stroke();
  }
  ctx.restore();
  for (const star of g.stars) {
    trace(ctx, g, star, 0, star.pass ? 1 : GATE);
    ctx.strokeStyle = rgba(col.accent, star.pass ? 0.2 : 0.085);
    ctx.lineWidth = star.pass ? 1 : 0.7;
    ctx.stroke();
    const p = position(g, star, 0);
    sparkle(ctx, p.x, p.y, star.size, rgba(star.source.heatOnly ? col.ink : col.accent, col.dark ? 0.8 : 0.65));
  }
}

export function SignalRiver({ sources, focus, onArrive, className = "", children }: {
  sources: RiverSource[];
  focus: number | null;
  onArrive?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(focus);
  const arriveRef = useRef(onArrive);
  const redrawRef = useRef<() => void>(() => {});
  arriveRef.current = onArrive;
  useEffect(() => { focusRef.current = focus; redrawRef.current(); }, [focus]);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, label = labelRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !label || !ctx) return;
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let still = reducedMotion();
    let g: Galaxy | null = null;
    let col = readColors(probe), dpr = 1, frame = 0, last = 0, seconds = 0, spawnDebt = 0;
    let flashAt = -Infinity;
    let pulses: Pulse[] = [];
    let hover: { star: number; progress: number } | null = null;
    const box = wrap.getBoundingClientRect();
    let visible = box.bottom > 0 && box.top < window.innerHeight;
    let disposed = false;

    const build = () => {
      if (wrap.clientWidth < 10 || wrap.clientHeight < 10) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [canvas, layer]) { c.width = Math.round(wrap.clientWidth * dpr); c.height = Math.round(wrap.clientHeight * dpr); }
      g = layout(wrap.clientWidth, wrap.clientHeight, sources);
      pulses = g.stars.map((_, i) => ({ star: i, progress: (i * 0.137) % 0.58, speed: 0.1 + (i % 4) * 0.008 }));
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStatic(lctx, g, col);
    };

    const draw = (now: number) => {
      if (!g) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const stage = focusRef.current;
      if (stage !== null && stage !== undefined) {
        const outer = 1 - stage / 4, inner = Math.max(0, outer - 0.25);
        ctx.beginPath();
        ctx.ellipse(g.cx, g.cy, g.radius + (g.rx - g.radius) * outer, g.radius + (g.ry - g.radius) * outer, 0, 0, TAU);
        ctx.ellipse(g.cx, g.cy, g.radius + (g.rx - g.radius) * inner, g.radius + (g.ry - g.radius) * inner, 0, 0, TAU, true);
        ctx.fillStyle = rgba(col.accent, 0.05); ctx.fill("evenodd");
      }
      if (hover) {
        const star = g.stars[hover.star]!;
        trace(ctx, g, star, 0, star.pass ? 1 : GATE);
        ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(col.accent, 0.65); ctx.stroke();
      }
      for (const pulse of pulses) {
        const star = g.stars[pulse.star]!;
        const fade = star.pass ? 1 : 1 - smooth((pulse.progress - 0.48) / (GATE - 0.48));
        const focused = stage === null || stage === undefined || Math.min(3, Math.floor(pulse.progress * 4)) === stage;
        const alpha = fade * (focused ? 1 : 0.25);
        const start = position(g, star, Math.max(0, pulse.progress - 0.09)), head = position(g, star, pulse.progress);
        const trail = ctx.createLinearGradient(start.x, start.y, head.x + 0.01, head.y + 0.01);
        trail.addColorStop(0, rgba(col.accent, 0)); trail.addColorStop(1, rgba(col.accent, alpha * 0.75));
        trace(ctx, g, star, Math.max(0, pulse.progress - 0.09), pulse.progress);
        ctx.lineWidth = 1.3; ctx.strokeStyle = trail; ctx.stroke();
        sparkle(ctx, head.x, head.y, star.size * 0.9, rgba(col.accent, alpha));
      }
      // Redraw the planet above passing trails, with a quiet glow on each selected arrival.
      planet(ctx, g, col, Math.max(0, 1 - (now - flashAt) / FLASH_MS), seconds);
    };
    const schedule = () => {
      if (!frame && !still && visible && !document.hidden && !disposed) frame = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || !g || !visible || document.hidden) { last = 0; return; }
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
      seconds += dt;
      spawnDebt += dt * (g.w >= 900 ? 6 : 4);
      while (spawnDebt >= 1 && pulses.length < 80 && g.stars.length) {
        spawnDebt--;
        pulses.push({ star: Math.floor(Math.random() * g.stars.length), progress: 0, speed: 0.1 + Math.random() * 0.035 });
      }
      pulses = pulses.filter((pulse) => {
        pulse.progress += pulse.speed * dt;
        const star = g!.stars[pulse.star]!;
        if (pulse.progress < (star.pass ? 1 : GATE)) return true;
        if (star.pass) { flashAt = now; arriveRef.current?.(); }
        return false;
      });
      draw(now); schedule();
    };
    const redraw = () => { if (still || !frame) draw(performance.now()); };
    redrawRef.current = redraw;
    const leave = () => { hover = null; label.hidden = true; redraw(); };
    const move = (event: PointerEvent) => {
      if (!g) return;
      if ((event.target as Element).closest("a, button")) { leave(); return; }
      const rect = wrap.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      let title = "", note = "";
      if (Math.hypot(x - g.cx, y - g.cy) < g.radius * 1.2) {
        hover = null; title = withSubject("日报"); note = `${EDITION.daily} · 星系汇聚示意`;
      } else {
        let distance = 9, best: { star: number; progress: number } | null = null;
        g.stars.forEach((star, i) => {
          const end = star.pass ? 1 : GATE;
          for (let step = 0; step <= 64; step++) {
            const progress = step / 64 * end, p = position(g!, star, progress);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < distance) { distance = d; best = { star: i, progress }; }
          }
        });
        hover = best;
        if (hover) {
          const hit = hover as { star: number; progress: number }, star = g.stars[hit.star]!;
          if (hit.progress < 0.25) { title = star.source.name; note = `${KIND[star.source.kind] ?? "信源"}${star.source.heatOnly ? " · 只计入热度" : ""}`; }
          else if (hit.progress < 0.5) { title = "同一件事"; note = "多源报道汇聚 · 流程示意"; }
          else { title = star.pass ? "进了精选" : "没进精选"; note = star.pass ? "有信息量，分数也够 · 流程示意" : "信息不够、重复或只是营销 · 流程示意"; }
        }
      }
      if (!title) { leave(); return; }
      const [heading, detail] = label.children as unknown as [HTMLElement, HTMLElement];
      heading.textContent = title; detail.textContent = note; detail.hidden = !note; label.hidden = false;
      const left = Math.max(8, Math.min(x + 14, wrap.clientWidth - label.offsetWidth - 8));
      const top = Math.max(8, Math.min(y + 16, wrap.clientHeight - label.offsetHeight - 8));
      label.style.transform = `translate(${left}px, ${top}px)`; redraw();
    };
    const resize = new ResizeObserver(() => { build(); redraw(); });
    const seen = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; last = 0; schedule(); });
    const onVisibility = () => { last = 0; schedule(); };
    const onMotion = () => {
      still = motion.matches; last = 0;
      if (still && frame) { cancelAnimationFrame(frame); frame = 0; }
      redraw(); schedule();
    };
    build(); draw(performance.now()); schedule(); resize.observe(wrap); seen.observe(wrap);
    const unwatch = watchAppearance((change) => {
      if (change === "theme") { col = readColors(probe); if (g) paintStatic(lctx, g, col); redraw(); }
    });
    document.addEventListener("visibilitychange", onVisibility); motion.addEventListener("change", onMotion);
    wrap.addEventListener("pointermove", move); wrap.addEventListener("pointerleave", leave);
    return () => {
      disposed = true; if (frame) cancelAnimationFrame(frame); redrawRef.current = () => {};
      resize.disconnect(); seen.disconnect(); unwatch(); document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion); wrap.removeEventListener("pointermove", move); wrap.removeEventListener("pointerleave", leave);
    };
  }, [sources]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />
      <div ref={labelRef} hidden className="pointer-events-none absolute left-0 top-0 z-10 max-w-[240px] rounded-control bg-surface px-2.5 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.08)] ring-1 ring-line">
        <div className="truncate text-[12.5px] font-semibold text-ink" />
        <div className="mt-0.5 truncate text-[11.5px] text-ink-4" />
      </div>
      {children}
    </div>
  );
}
