import { Link, useLocation } from "react-router";
import { SITE } from "@aihot/site";
import { IconChevronRight, IconRss } from "../icons";
import { SearchField } from "../../features/feed/Filters";
import { useScreen } from "./screens";

export function DesktopHeader() {
  const screen = useScreen();
  const { pathname } = useLocation();
  const title = screen.name ?? (pathname.startsWith("/items/") ? "文章阅读" : "资讯");
  return (
    <header className="mb-8 hidden min-h-[56px] items-center justify-between gap-6 border-b border-line pb-5 lg:flex">
      <nav aria-label="当前位置" className="flex items-center gap-3 text-[13px]">
        <Link to="/" className="text-ink-3 hover:text-ink">{SITE.name}</Link>
        <IconChevronRight size={13} className="text-ink-3" />
        <span className="font-medium text-ink">{title}</span>
      </nav>
      <div className="flex items-center gap-5">
        {pathname !== "/" && pathname !== "/all" && <SearchField />}
        {pathname !== "/" && <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 text-[13px] font-medium text-ink hover:text-accent"><IconRss size={16} />订阅 RSS</a>}
      </div>
    </header>
  );
}
