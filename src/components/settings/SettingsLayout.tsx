import { NavLink, useLocation, Outlet } from "react-router-dom";
import { 
  User, 
  Bell, 
  Settings, 
  Users, 
  MessageSquare, 
  FolderOpen, 
  UserCheck, 
  Package, 
  Plug, 
  FileText, 
  CreditCard, 
  AlertTriangle,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const personalSettingsItems = [
  { title: "Profile", href: "/settings/profile", icon: User, testId: "profile-section" },
  { title: "Notifications", href: "/settings/notifications", icon: Bell, testId: "notifications-section" },
];

const organizationSettingsItems = [
  { title: "General", href: "/settings/general", icon: Settings, testId: "general-section" },
  { title: "Team Management", href: "/settings/team", icon: Users, testId: "team-section" },
  { title: "Client Messaging", href: "/settings/client-messaging", icon: MessageSquare, testId: "client-messaging-section" },
  { title: "Projects & Sessions", href: "/settings/projects", icon: FolderOpen, testId: "projects-section" },
  { title: "Lead Management", href: "/settings/leads", icon: UserCheck, testId: "leads-section" },
  { title: "Packages & Services", href: "/settings/services", icon: Package, testId: "services-section" },
  { title: "Integrations", href: "/settings/integrations", icon: Plug, testId: "integrations-section" },
  { title: "Contracts", href: "/settings/contracts", icon: FileText, testId: "contracts-section" },
  { title: "Billing & Payments", href: "/settings/billing", icon: CreditCard, testId: "billing-section" },
  { title: "Danger Zone", href: "/settings/danger-zone", icon: AlertTriangle, testId: "danger-section" },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { hasCategoryChanges } = useSettingsContext();
  const { shouldLockNavigation } = useOnboardingV2();
  
  const isItemLocked = (itemHref: string) => {
    console.log('🔍 Settings item lock check:', {
      itemHref,
      shouldLockNavigation
    });

    // Simple rule: During guided setup, only allow general settings
    if (shouldLockNavigation) {
      // Allow general settings during guided setup
      const isUnlocked = itemHref === '/settings';
      console.log(`🔒 Guided setup: ${itemHref} - ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}`);
      return !isUnlocked;
    }
    
    // Not in guided setup - everything is unlocked
    console.log(`📊 Normal mode: ${itemHref} - UNLOCKED`);
    return false;
  };

  const handleLockedItemClick = (e: React.MouseEvent, itemHref: string) => {
    if (isItemLocked(itemHref)) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Settings Navigation - Left sidebar for all screen sizes */}
      <div className="w-16 md:w-80 border-r bg-muted/10 flex-shrink-0">
        <div className="p-2 md:p-6">
          <h2 className="text-xl font-bold mb-6 hidden md:block">Settings</h2>
          
          {/* Personal Settings */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 hidden md:block">
              Personal Settings
            </h3>
            <nav className="space-y-1">
              {personalSettingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                const hasChanges = hasCategoryChanges(item.href);
                const locked = isItemLocked(item.href);
                
                const linkContent = (
                  <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative",
                    "hover:bg-sidebar-accent",
                    isActive 
                      ? "bg-sidebar-active text-sidebar-active-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground",
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => handleLockedItemClick(e, item.href)}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="hidden md:flex md:items-center md:gap-2">
                    {item.title}
                    {hasChanges && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    )}
                    {locked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                  </span>
                  {/* Show dot on mobile too */}
                  {hasChanges && (
                    <div className="md:hidden absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  )}
                </div>
                );
                
                return locked ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <div data-walkthrough={item.testId}>
                        {linkContent}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Complete the guided setup first</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    data-walkthrough={item.testId}
                  >
                    {linkContent}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Organization Settings */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 hidden md:block">
              Organization Settings
            </h3>
            <nav className="space-y-1">
              {organizationSettingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                const hasChanges = hasCategoryChanges(item.href);
                const locked = isItemLocked(item.href);
                const isDangerZone = item.title === "Danger Zone";
                
                const linkContent = (
                  <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative",
                    !isDangerZone && "hover:bg-sidebar-accent",
                    isActive 
                      ? "bg-sidebar-active text-sidebar-active-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground",
                    isDangerZone && "text-red-600 hover:text-red-700 hover:bg-red-50",
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => handleLockedItemClick(e, item.href)}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isDangerZone && "text-red-600"
                  )} />
                  <span className="hidden md:flex md:items-center md:gap-2">
                    {item.title}
                    {hasChanges && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    )}
                    {locked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                  </span>
                  {/* Show dot on mobile too */}
                  {hasChanges && (
                    <div className="md:hidden absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  )}
                </div>
                );
                
                return locked ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <div data-walkthrough={item.testId}>
                        {linkContent}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Complete the guided setup first</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    data-walkthrough={item.testId}
                  >
                    {linkContent}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}