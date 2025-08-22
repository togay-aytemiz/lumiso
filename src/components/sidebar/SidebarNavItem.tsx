import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Lock, LucideIcon } from "lucide-react";
import { 
  SidebarMenuItem, 
  SidebarMenuButton 
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      className={`flex items-center gap-3 w-full ${isLocked ? 'opacity-50' : ''}`}
      onClick={isLocked ? onLockedClick : undefined}
    >
      <Icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-sidebar-primary group-data-[active=true]/item:text-[hsl(var(--sidebar-active-icon))] transition-colors" />
      <span className="font-medium text-sm">{title}</span>
      {badge && <div className="ml-auto">{badge}</div>}
      {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
    </div>
  );

  const buttonContent = isLocked ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarMenuButton
          className={`group/item w-full h-10 px-3 py-2 text-left transition-all duration-200 rounded-lg cursor-not-allowed ${className}`}
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
      className={`group/item w-full h-10 px-3 py-2 text-left transition-all duration-200 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground data-[active=true]:font-medium ${className}`}
    >
      <NavLink to={url} className="flex items-center gap-3 w-full">
        {content}
      </NavLink>
    </SidebarMenuButton>
  ) : (
    <SidebarMenuButton
      onClick={onClick}
      isActive={isActive}
      className={`group/item w-full h-10 px-3 py-2 text-left transition-all duration-200 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground data-[active=true]:font-medium ${className}`}
    >
      {content}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      {buttonContent}
      {children && (
        <div className="ml-6 mt-1 space-y-1">
          {children}
        </div>
      )}
    </SidebarMenuItem>
  );
}