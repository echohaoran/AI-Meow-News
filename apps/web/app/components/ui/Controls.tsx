import type { ReactNode, SelectHTMLAttributes } from "react";
import { IconCheck, IconChevronDown } from "../icons";

type Variant = "primary" | "secondary";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover disabled:bg-bg-muted disabled:text-ink-3",
  secondary: "border border-control bg-surface text-ink hover:border-ink-3 hover:bg-bg-sunk disabled:bg-bg-muted disabled:text-ink-3",
};

type Size = "md" | "lg";
const SIZES: Record<Size, string> = { md: "h-11 px-4 text-[14px] lg:h-9", lg: "h-11 px-6 text-[14px] sm:h-[52px]" };

/** Shared button classes, including links that look like buttons. */
export function buttonClass(variant: Variant = "secondary", size: Size = "md"): string {
  return `inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150 ${SIZES[size]} ${VARIANTS[variant]}`;
}

/** Native select with the site's shared control shape. */
export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        className="h-11 w-full cursor-pointer appearance-none rounded-control border border-control bg-surface py-0 pl-3.5 pr-8 text-[16px] text-ink outline-none lg:h-9 lg:text-[14px] transition-colors hover:border-ink-3 focus:border-accent"
        {...rest}
      >
        {children}
      </select>
      <IconChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-4" />
    </span>
  );
}

/**
 * A filter that combines with others: a pill with its own small check mark, so a row of them reads
 * as "pick any" rather than the one-of-many `PillTabs` switch.
 */
export function ToggleChip({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`inline-flex h-11 shrink-0 lg:h-9 select-none items-center gap-1.5 whitespace-nowrap rounded-control border pl-2 pr-3.5 text-[14px] font-medium transition-colors duration-150 active:scale-[0.98] ${on ? "border-accent/35 bg-accent-soft text-accent" : "border-line-strong bg-surface text-ink-2 hover:border-ink-4 hover:text-ink"}`}
    >
      <span aria-hidden="true" className={`inline-flex size-4 items-center justify-center rounded-mark border transition-colors duration-150 ${on ? "border-accent bg-accent text-accent-contrast" : "border-line-strong"}`}>
        {on && <IconCheck size={11} strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
