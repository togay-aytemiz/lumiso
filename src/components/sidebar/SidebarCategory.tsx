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
      <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {children}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}