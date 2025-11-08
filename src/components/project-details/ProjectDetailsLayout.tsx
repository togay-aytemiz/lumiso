import { ReactNode, useMemo, type RefObject } from "react";
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
  scrollContainerRef?: RefObject<HTMLElement | null>;
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
  navAriaLabel = "Section navigation",
  scrollContainerRef
}: ProjectDetailsLayoutProps) {
  const navItems = useMemo<StickySectionNavItem[]>(() => {
    const sectionNav = sections.map((section) => ({
      id: section.id,
      title: section.title
    }));

    if (!showOverviewNav) {
      return sectionNav;
    }

    const handleOverviewSelect = () => {
      if (onOverviewScroll) {
        onOverviewScroll();
        return;
      }

      const container = scrollContainerRef?.current;
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    return [
      {
        id: overviewNavId,
        title: overviewLabel,
        onSelect: handleOverviewSelect
      },
      ...sectionNav
    ];
  }, [sections, showOverviewNav, overviewNavId, overviewLabel, onOverviewScroll, scrollContainerRef]);

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
        stickyTopOffset={stickyTopOffset}
        align={navAlign}
        ariaLabel={navAriaLabel}
        scrollContainerRef={scrollContainerRef}
        fallbackActiveId={showOverviewNav ? overviewNavId : sections[0]?.id}
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
