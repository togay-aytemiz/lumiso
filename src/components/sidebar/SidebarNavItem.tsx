import {
  Fragment,
  type MouseEventHandler,
  ReactNode,
  type MouseEvent,
} from "react";
import { NavLink } from "react-router-dom";
import { Lock, LucideIcon } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CollapsedSubItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
  onLockedClick?: (e: MouseEvent) => void;
}

interface SidebarNavItemProps {
  title: string;
  url?: string;
  icon: LucideIcon;
  isActive?: boolean;
  isLocked?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  onLockedClick?: (e: MouseEvent) => void;
  children?: ReactNode;
  className?: string;
  badge?: ReactNode;
  state?: unknown;
  collapsedItems?: CollapsedSubItem[];
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
  badge,
  state,
  collapsedItems = [],
}: SidebarNavItemProps) {
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";

  const buttonClasses = cn(
    "group/item w-full h-9 border border-transparent",
    "data-[active=true]:bg-[linear-gradient(135deg,_hsl(var(--accent-100)),_hsl(var(--accent-300)))]",
    "data-[active=true]:border-[hsl(var(--accent-300))]",
    "data-[active=true]:shadow-[0_26px_45px_-32px_hsl(var(--accent-400)_/_0.95)]",
    "group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:rounded-2xl",
    className
  );

  const content = (
    <div
      className={cn(
        "flex items-center gap-2.5 w-full text-sm font-medium tracking-tight transition-colors",
        "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
        isLocked && "opacity-50"
      )}
      onClick={isLocked ? onLockedClick : undefined}
    >
      <Icon
        className={cn(
          "h-5 w-5 text-sidebar-foreground/80 transition-colors group-hover/item:text-[hsl(var(--accent-600))] group-data-[active=true]/item:text-[hsl(var(--accent-600))]",
          "group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6",
          isCollapsed &&
            "text-[hsl(var(--accent-200))] group-hover/item:text-[hsl(var(--accent-50))] group-data-[active=true]/item:text-white dark:text-[hsl(var(--accent-800))] dark:group-hover/item:text-[hsl(var(--accent-900))] dark:group-data-[active=true]/item:text-[hsl(var(--accent-900))]"
        )}
      />
      <span className="text-sidebar-foreground/90 transition-colors group-hover/item:text-[hsl(var(--accent-800))] group-data-[active=true]/item:text-[hsl(var(--accent-900))] group-data-[collapsible=icon]:hidden">
        {title}
      </span>
      {badge && (
        <div className="ml-auto group-data-[collapsible=icon]:hidden">{badge}</div>
      )}
      {isLocked && (
        <Lock className="h-3 w-3 ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" />
      )}
    </div>
  );

  const collapsedSubmenu =
    collapsedItems.length > 0 ? (
      <div className="mt-2 flex flex-col gap-1">
        {collapsedItems.map((item) => {
          const ItemIcon = item.icon;
          const sharedContent = (
            <>
              <ItemIcon className="h-4 w-4 text-sidebar-foreground/80" />
              <span className="text-sm text-sidebar-foreground/90">
                {item.title}
              </span>
              {item.isLocked && (
                <Lock className="ml-auto h-3 w-3 text-muted-foreground" />
              )}
            </>
          );

          if (item.isLocked) {
            return (
              <button
                key={item.url}
                type="button"
                onClick={item.onLockedClick}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground/90 transition-colors cursor-not-allowed"
              >
                {sharedContent}
              </button>
            );
          }

          return (
            <NavLink
              key={item.url}
              to={item.url}
              onClick={item.onClick}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                item.isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {sharedContent}
            </NavLink>
          );
        })}
      </div>
    ) : null;

  const tooltipContent = (
    <TooltipContent
      side="right"
      align="start"
      className="w-56 max-w-[15rem] p-3 text-left"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
        {collapsedSubmenu}
        {isLocked && (
          <p className="text-xs text-muted-foreground">
            Complete the guided setup first
          </p>
        )}
      </div>
    </TooltipContent>
  );

  const lockedButton = (
    <SidebarMenuButton
      className={cn(
        "group/item w-full h-9 cursor-not-allowed rounded-xl border border-transparent",
        "bg-[linear-gradient(135deg,_hsl(var(--accent-50)),_hsl(var(--accent-100)))] text-[hsl(var(--accent-800))]",
        "group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:rounded-2xl",
        className
      )}
    >
      {content}
    </SidebarMenuButton>
  );

  const activeButton = url ? (
    <SidebarMenuButton asChild isActive={isActive} className={buttonClasses}>
      <NavLink
        to={url}
        state={state}
        onClick={onClick}
        aria-label={title}
        className={cn(
          "flex items-center gap-2.5 w-full",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
        )}
      >
        {content}
      </NavLink>
    </SidebarMenuButton>
  ) : (
    <SidebarMenuButton
      onClick={onClick}
      isActive={isActive}
      className={buttonClasses}
      aria-label={title}
    >
      {content}
    </SidebarMenuButton>
  );

  const renderedButton = isLocked
    ? (
        <Tooltip>
          <TooltipTrigger asChild>{lockedButton}</TooltipTrigger>
          {isCollapsed ? tooltipContent : (
            <TooltipContent side="right">
              <p>Complete the guided setup first</p>
            </TooltipContent>
          )}
        </Tooltip>
      )
    : isCollapsed
    ? (
        <Tooltip>
          <TooltipTrigger asChild>{activeButton}</TooltipTrigger>
          {tooltipContent}
        </Tooltip>
      )
    : (
        activeButton
      );

  return (
    <SidebarMenuItem>
      {renderedButton}
      {!isCollapsed && children && (
        <Fragment>{children}</Fragment>
      )}
    </SidebarMenuItem>
  );
}
