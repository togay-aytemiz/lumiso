import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

const BASE_NAV_BUTTON_CLASSES = [
  "flex-shrink-0",
  "whitespace-nowrap",
  "rounded-full",
  "border",
  "px-3",
  "py-1.5",
  "text-sm",
  "font-medium",
  "transition-colors",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-primary"
].join(" ");

interface ProjectDetailsLayoutProps {
  header: ReactNode;
  left: ReactNode;
  sections: { id: string; title: string; content: ReactNode }[];
  rightFooter?: ReactNode;
}

export default function ProjectDetailsLayout({ header, left, sections, rightFooter }: ProjectDetailsLayoutProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id || "");
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headings = sections.map((s) => document.getElementById(s.id));
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
    headings.forEach((el) => el && observer.current?.observe(el));
    return () => observer.current?.disconnect();
  }, [sections]);

  useEffect(() => {
    if (sections.length === 0) {
      setActiveId("");
      return;
    }

    setActiveId((prev) => {
      if (prev && sections.some((section) => section.id === prev)) {
        return prev;
      }
      return sections[0].id;
    });
  }, [sections]);

  const navItems = useMemo(
    () => sections.map((section) => ({ id: section.id, title: section.title })),
    [sections]
  );

  const handleNavClick = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full min-h-screen">
      {/* Header */}
      <header className="mb-4">{header}</header>

      {navItems.length > 0 && (
        <div className="sticky top-0 z-30 -mx-2 mb-6 border-b border-border/40 bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <nav
            className="flex items-center gap-2 overflow-x-auto"
            aria-label="Project sections navigation"
          >
            {navItems.map((item) => {
              const isActive = activeId === item.id;
              const buttonClasses = [
                BASE_NAV_BUTTON_CLASSES,
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-transparent bg-muted/70 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              ].join(" ");

              return (
                <button
                  key={item.id}
                  type="button"
                  className={buttonClasses}
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.title}
                </button>
              );
            })}
          </nav>
        </div>
      )}

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
