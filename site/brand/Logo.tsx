// AI喵实验室：几何猫耳与信息节点。字标使用站点文字，不依赖外部图片或字体。
import { SITE } from "../site.ts";

export function Wordmark({ size = 24, className = "", title = SITE.name }: { size?: number; className?: string; title?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.28em] whitespace-nowrap font-semibold leading-none tracking-[-0.035em] ${className}`} style={{ fontSize: Math.round(size * 0.82) }} aria-label={title} role="img">
      <RingMark className="size-[1.2em] shrink-0 rounded-control bg-action p-0.5 text-on-action" />
      <span aria-hidden="true">{SITE.name}</span>
    </span>
  );
}

/** Same cat mark in the wordmark, icon and loading state. */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g style={spinning ? { transformOrigin: "16px 16px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <path d="M5 15 5 5 13 10Q16 9 19 10L27 5 27 15Q29 29 16 29 3 29 5 15Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M11 17v2m10-2v2m-8 4 3 2 3-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="27" cy="5" r="3" fill="currentColor" />
      </g>
    </svg>
  );
}
