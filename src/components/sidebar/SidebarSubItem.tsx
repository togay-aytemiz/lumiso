import { NavLink } from "react-router-dom";
import { Lock, LucideIcon } from "lucide-react";
import { 
  SidebarMenuItem, 
  SidebarMenuButton 
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const content = (
    <div 
      className={`flex items-center gap-3 w-full ${isLocked ? 'opacity-50' : ''}`}
      onClick={isLocked ? onLockedClick : undefined}
    >
      <Icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-sidebar-primary group-data-[active=true]/item:text-sidebar-active-foreground transition-colors" />
      <span className="font-medium text-sm">{title}</span>
      {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
    </div>
  );

  return (
    <SidebarMenuItem>
      {isLocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              className="group/item w-full h-9 px-3 py-2 text-left transition-all duration-200 rounded-lg cursor-not-allowed"
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
          className="group/item w-full h-9 px-3 py-2 text-left transition-all duration-200 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground data-[active=true]:font-medium"
        >
          <NavLink to={url} className="flex items-center gap-3 w-full" onClick={onClick}>
            {content}
          </NavLink>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}