import { ReactNode } from "react";
import { 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent,
  SidebarMenu 
} from "@/components/ui/sidebar";

interface SidebarCategoryProps {
  title: string;
  children: ReactNode;
}

export function SidebarCategory({ title, children }: SidebarCategoryProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/90 uppercase tracking-[0.18em] mb-1.5">
        {title}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">
          {children}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}