import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Lock, LucideIcon } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  title: string;
  url?: string;
  icon: LucideIcon;
  isActive?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
  onLockedClick?: (e: React.MouseEvent) => void;
  children?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

export function SidebarNavItem({ 
  title, 
  url, 
  icon: Icon, 
  isActive = false, 
  isLocked = false,
  onClick,
  onLockedClick,
  children,
  className = "",
  badge
}: SidebarNavItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-2.5 w-full text-sm font-medium tracking-tight transition-colors",
        isLocked && "opacity-50"
      )}
      onClick={isLocked ? onLockedClick : undefined}
    >
      <Icon className="h-4 w-4 text-sidebar-foreground/80 transition-colors group-hover/item:text-[hsl(var(--accent-600))] group-data-[active=true]/item:text-[hsl(var(--accent-600))]" />
      <span className="text-sidebar-foreground/90 transition-colors group-hover/item:text-[hsl(var(--accent-800))] group-data-[active=true]/item:text-[hsl(var(--accent-900))]">
        {title}
      </span>
      {badge && <div className="ml-auto">{badge}</div>}
      {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
    </div>
  );

  const buttonContent = isLocked ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarMenuButton
          className={cn(
            "group/item w-full h-9 cursor-not-allowed rounded-xl",
            "bg-[linear-gradient(135deg,_hsl(var(--accent-50)),_hsl(var(--accent-100)))] text-[hsl(var(--accent-800))]",
            className
          )}
        >
          {content}
        </SidebarMenuButton>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Complete the guided setup first</p>
      </TooltipContent>
    </Tooltip>
  ) : url ? (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        "group/item w-full h-9",
        "data-[active=true]:shadow-[0_26px_45px_-32px_hsl(var(--accent-400)_/_0.95)]",
        "data-[active=true]:before:absolute data-[active=true]:before:inset-[2px] data-[active=true]:before:-z-10 data-[active=true]:before:rounded-[calc(var(--radius)-0.375rem)] data-[active=true]:before:bg-[radial-gradient(circle_at_top,_hsl(var(--accent-100)),_transparent_65%)] data-[active=true]:before:content-['']",
        className
      )}
    >
      <NavLink to={url} className="flex items-center gap-2.5 w-full">
        {content}
      </NavLink>
    </SidebarMenuButton>
  ) : (
    <SidebarMenuButton
      onClick={onClick}
      isActive={isActive}
      className={cn(
        "group/item w-full h-9",
        "data-[active=true]:shadow-[0_26px_45px_-32px_hsl(var(--accent-400)_/_0.95)]",
        "data-[active=true]:before:absolute data-[active=true]:before:inset-[2px] data-[active=true]:before:-z-10 data-[active=true]:before:rounded-[calc(var(--radius)-0.375rem)] data-[active=true]:before:bg-[radial-gradient(circle_at_top,_hsl(var(--accent-100)),_transparent_65%)] data-[active=true]:before:content-['']",
        className
      )}
    >
      {content}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      {buttonContent}
      {children && (
        <div className="ml-6 mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </SidebarMenuItem>
  );
}