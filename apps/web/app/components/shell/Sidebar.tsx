import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { IntentLink } from "../ui/IntentLink";
import { SITE } from "@aihot/site";
import { Wordmark } from "@aihot/site/brand/Logo.tsx";
import { SocialLinks } from "@aihot/site/brand/SocialLinks.tsx";
import { useChangelogSeen } from "../../lib/local-state";
import { sidebar, sidebarIsActive, type NavItem } from "./nav";
import { ThemeSwitch } from "./ThemeSwitch";
import { Filings } from "./Filings";
import { IconGithub } from "../icons";

/** True while the changelog has an entry newer than the one this reader last opened. */
export function useChangelogDot(latestVersion: string | null): boolean {
  const seen = useChangelogSeen();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !latestVersion) return false;
  return !seen || seen < latestVersion;
}

function SideLink({ item, dot }: { item: NavItem; dot: boolean }) {
  const { pathname } = useLocation();
  const isActive = sidebarIsActive(item, pathname);
  const Icon = item.icon;
  return (
    <IntentLink
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex h-11 items-center gap-3 rounded-control px-3 text-[14px] transition-colors duration-150 ${
        isActive ? "bg-accent-soft font-semibold text-ink before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-mark before:bg-action" : "font-medium text-ink-3 hover:bg-bg-sunk hover:text-ink"
      }`}
    >
      <span className={`flex w-[22px] shrink-0 justify-center ${isActive ? "text-accent" : ""}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
      {dot && item.changelog && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-hot" aria-label="有新的更新" />}
    </IntentLink>
  );
}

export function Sidebar({ changelogVersion }: { changelogVersion: string | null }) {
  const dot = useChangelogDot(changelogVersion);
  return (
    <aside className="sticky top-0 z-30 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-line bg-sidebar px-5 pb-5 pt-6 lg:flex">
      <Link to="/" className="mb-6 flex min-h-[72px] flex-col items-start justify-center gap-3 px-3 text-ink" aria-label={`${SITE.name} 首页`}>
        <Wordmark size={30} />
        <span className="text-[12px] text-ink-3">AI喵实验室 · 有出处的 AI 观察</span>
      </Link>
      <nav className="scrollbar-thin -mx-1 flex-1 overflow-y-auto px-1" aria-label="主导航">
        {sidebar().map((section) => (
          <div key={section.title}>
            <div className="px-3 pb-2 pt-5 text-[12px] text-ink-4">{section.title}</div>
            <div className="flex flex-col gap-1.5">
              {section.items.map((item) => (
                <SideLink key={item.to} item={item} dot={dot} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-2 space-y-2.5 px-1 pt-1">
        <SocialLinks />
        {SITE.github && (
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 flex h-9 items-center justify-center gap-2 rounded-control border border-line text-[13px] text-ink-3 transition-colors hover:bg-bg-sunk hover:text-ink"
          >
            <IconGithub size={14} />
            GitHub 开源
          </a>
        )}
        <ThemeSwitch className="mx-1" />
        {/* Centred under the buttons; the full width keeps the longer public-security number on one line. */}
        <div className="-mx-1 flex flex-col items-center gap-1.5">
          <Filings className="whitespace-nowrap text-[9.5px] leading-[1.3] text-ink-4 hover:text-ink-3" badgeSize={10} />
        </div>
      </div>
    </aside>
  );
}
