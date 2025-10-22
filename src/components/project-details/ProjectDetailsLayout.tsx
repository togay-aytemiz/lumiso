import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import StickySectionNav, { StickySectionNavItem } from "./StickySectionNav";
const DEFAULT_OVERVIEW_ID = "project-overview";
const DEFAULT_OVERVIEW_LABEL = "Overview";

interface ProjectDetailsLayoutProps {
  header: ReactNode;
  left: ReactNode;
  sections: { id: string; title: string; content: ReactNode }[];
  rightFooter?: ReactNode;
  stickyTopOffset?: number;
  showOverviewNav?: boolean;
  overviewNavId?: string;
  overviewLabel?: string;
  onOverviewScroll?: () => void;
  navAlign?: "start" | "center" | "end";
  navAriaLabel?: string;
}

export default function ProjectDetailsLayout({
  header,
  left,
  sections,
  rightFooter,
  stickyTopOffset = 0,
  showOverviewNav = true,
  overviewNavId = DEFAULT_OVERVIEW_ID,
  overviewLabel = DEFAULT_OVERVIEW_LABEL,
  onOverviewScroll,
  navAlign = "end",
  navAriaLabel = "Section navigation"
}: ProjectDetailsLayoutProps) {
  const [activeId, setActiveId] = useState<string>(
    showOverviewNav ? overviewNavId : sections[0]?.id || ""
  );
  const observer = useRef<IntersectionObserver | null>(null);
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const observedIds = useMemo(
    () => (showOverviewNav ? [overviewNavId, ...sectionIds] : sectionIds),
    [sectionIds, showOverviewNav, overviewNavId]
  );

  useEffect(() => {
    const headings = observedIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    observer.current?.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: [0, 0.5, 1] }
    );
    headings.forEach((el) => observer.current?.observe(el));
    return () => observer.current?.disconnect();
  }, [observedIds]);

  useEffect(() => {
    if (observedIds.length === 0) {
      setActiveId("");
      return;
    }

    setActiveId((prev) => {
      if (prev && observedIds.includes(prev)) {
        return prev;
      }
      return observedIds[0];
    });
  }, [observedIds]);

  const navItems = useMemo<StickySectionNavItem[]>(() => {
    const sectionNav = sections.map((section) => ({ id: section.id, title: section.title }));
    return showOverviewNav
      ? [{ id: overviewNavId, title: overviewLabel }, ...sectionNav]
      : sectionNav;
  }, [sections, showOverviewNav, overviewNavId, overviewLabel]);

  const handleNavClick = (id: string) => {
    setActiveId(id);

    if (showOverviewNav && id === overviewNavId) {
      if (onOverviewScroll) {
        onOverviewScroll();
        return;
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="w-full min-h-screen">
      {showOverviewNav ? (
        <div
          id={overviewNavId}
          aria-hidden="true"
          className="pointer-events-none h-1 w-full opacity-0"
        />
      ) : null}
      {/* Header */}
      {header ? <header className="mb-4">{header}</header> : null}

      <StickySectionNav
        items={navItems}
        activeId={activeId}
        onSelect={handleNavClick}
        stickyTopOffset={stickyTopOffset}
        align={navAlign}
        ariaLabel={navAriaLabel}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6 w-full max-w-full overflow-hidden">
        {/* Left summary column */}
        <aside className="col-span-12 lg:col-span-4 min-w-0">
          <div className="h-fit space-y-4 w-full max-w-full">
            {left}
          </div>
        </aside>

        {/* Right detail column */}
        <main className="col-span-12 lg:col-span-8 min-w-0">
          <div className="space-y-6 md:space-y-8 w-full max-w-full">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-[88px] w-full max-w-full overflow-hidden">
                <div className="w-full max-w-full">{s.content}</div>
              </section>
            ))}
            {rightFooter ? <div className="w-full max-w-full">{rightFooter}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
