import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

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

  const handleNavClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full min-h-screen">
      {/* Header */}
      <header className="mb-4">{header}</header>

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
