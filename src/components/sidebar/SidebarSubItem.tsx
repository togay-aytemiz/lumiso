import { NavLink } from "react-router-dom";
import { Lock, LucideIcon } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarSubItemProps {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  isLocked?: boolean;
  onLockedClick?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

export function SidebarSubItem({ 
  title, 
  url, 
  icon: Icon, 
  isActive = false, 
  isLocked = false,
  onLockedClick,
  onClick
}: SidebarSubItemProps) {
  const buttonClasses = cn(
    "group/item w-full h-8 border border-transparent pl-9 pr-3",
    "group-data-[collapsible=icon]:pl-0 group-data-[collapsible=icon]:pr-0",
    "data-[active=true]:bg-[linear-gradient(135deg,_hsl(var(--accent-100)),_hsl(var(--accent-300)))]",
    "data-[active=true]:border-[hsl(var(--accent-300))]",
    "data-[active=true]:shadow-[0_20px_36px_-28px_hsl(var(--accent-400)_/_0.85)]"
  );

  const content = (
    <div
      className={cn(
        "flex items-center gap-2.5 w-full text-sm transition-colors",
        isLocked && "opacity-50"
      )}
      onClick={isLocked ? onLockedClick : undefined}
    >
      <Icon className="h-4 w-4 text-sidebar-foreground/75 transition-colors group-hover/item:text-[hsl(var(--accent-600))] group-data-[active=true]/item:text-[hsl(var(--accent-600))]" />
      <span className="text-sidebar-foreground/80 transition-colors group-hover/item:text-[hsl(var(--accent-800))] group-data-[active=true]/item:text-[hsl(var(--accent-900))]">
        {title}
      </span>
      {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
    </div>
  );

  return (
    <SidebarMenuItem>
      {isLocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              className="group/item w-full h-8 cursor-not-allowed rounded-lg border border-transparent bg-[linear-gradient(135deg,_hsl(var(--accent-50)),_hsl(var(--accent-100)))] pl-9 pr-3 text-[hsl(var(--accent-800))] group-data-[collapsible=icon]:pl-0 group-data-[collapsible=icon]:pr-0"
            >
              {content}
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Complete the guided setup first</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={buttonClasses}
        >
          <NavLink to={url} className="flex items-center gap-2.5 w-full" onClick={onClick}>
            {content}
          </NavLink>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}
