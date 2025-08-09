import { ReactNode } from "react";

interface SectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export default function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-[88px]">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
