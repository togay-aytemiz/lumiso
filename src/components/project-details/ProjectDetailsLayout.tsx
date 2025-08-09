import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

interface ProjectDetailsLayoutProps {
  header: ReactNode;
  left: ReactNode;
  sections: { id: string; title: string; content: ReactNode }[];
}

export default function ProjectDetailsLayout({ header, left, sections }: ProjectDetailsLayoutProps) {
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
    <div className="w-full min-h-screen px-6 py-6">
      {/* Header */}
      <header className="mb-4">{header}</header>

      <div className="grid grid-cols-12 gap-6 w-full">
        {/* Left summary column */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="sticky top-[72px] h-fit min-w-[280px] space-y-4">
            {left}
          </div>
        </aside>

        {/* Right detail column */}
        <main className="col-span-12 lg:col-span-8">
          {/* Anchor sub-nav */}
          <nav className="sticky top-[64px] z-10 bg-white/80 backdrop-blur border-b">
            <div className="flex gap-4 overflow-x-auto py-2">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleNavClick(s.id)}
                  className={`px-2 py-1 text-sm rounded-md focus:outline-none focus:ring ${
                    activeId === s.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </nav>

          <div className="space-y-8 mt-4">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-[88px]">
                <h2 className="text-lg font-semibold mb-4">{s.title}</h2>
                <div>{s.content}</div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
