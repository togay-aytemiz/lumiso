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
import { useOnboarding } from "@/hooks/useOnboarding";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const personalSettingsItems = [
  { title: "Profile", href: "/settings/profile", icon: User, testId: "profile-section", requiredStep: 1 },
  { title: "Notifications", href: "/settings/notifications", icon: Bell, testId: "notifications-section", requiredStep: 5 },
];

const organizationSettingsItems = [
  { title: "General", href: "/settings/general", icon: Settings, testId: "general-section", requiredStep: 1 },
  { title: "Team Management", href: "/settings/team", icon: Users, testId: "team-section", requiredStep: 5 },
  { title: "Client Messaging", href: "/settings/client-messaging", icon: MessageSquare, testId: "client-messaging-section", requiredStep: 5 },
  { title: "Projects & Sessions", href: "/settings/projects", icon: FolderOpen, testId: "projects-section", requiredStep: 5 },
  { title: "Lead Management", href: "/settings/leads", icon: UserCheck, testId: "leads-section", requiredStep: 5 },
  { title: "Packages & Services", href: "/settings/services", icon: Package, testId: "services-section", requiredStep: 5 },
  { title: "Integrations", href: "/settings/integrations", icon: Plug, testId: "integrations-section", requiredStep: 5 },
  { title: "Contracts", href: "/settings/contracts", icon: FileText, testId: "contracts-section", requiredStep: 5 },
  { title: "Billing & Payments", href: "/settings/billing", icon: CreditCard, testId: "billing-section", requiredStep: 5 },
  { title: "Danger Zone", href: "/settings/danger-zone", icon: AlertTriangle, testId: "danger-section", requiredStep: 5 },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { hasCategoryChanges } = useSettingsContext();
  const { inGuidedSetup, completedCount } = useOnboarding();
  
  const isItemLocked = (requiredStep: number, itemHref: string) => {
    // Don't lock the current active page during onboarding
    if (inGuidedSetup && location.pathname === itemHref) {
      return false;
    }
    
    // Special handling for step 6 (packages setup)
    if (inGuidedSetup && completedCount === 5) {
      // During step 6, only unlock profile and packages & services
      const allowedInStep6 = ['/settings/profile', '/settings/services'];
      return !allowedInStep6.includes(itemHref);
    }
    
    // Special handling for step 1 (profile setup)
    if (inGuidedSetup && completedCount === 0) {
      // During step 1, only unlock profile and general
      const allowedInStep1 = ['/settings/profile', '/settings/general'];
      return !allowedInStep1.includes(itemHref);
    }
    
    return inGuidedSetup && completedCount < (requiredStep - 1);
  };

  const handleLockedItemClick = (e: React.MouseEvent, requiredStep: number, itemHref: string) => {
    if (isItemLocked(requiredStep, itemHref)) {
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
                const locked = isItemLocked(item.requiredStep, item.href);
                
                const linkContent = (
                  <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative",
                    "hover:bg-muted/50",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground",
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => handleLockedItemClick(e, item.requiredStep, item.href)}
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
                      <p>Unlocks after setup is complete</p>
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
                const locked = isItemLocked(item.requiredStep, item.href);
                const isDangerZone = item.title === "Danger Zone";
                
                const linkContent = (
                  <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative",
                    "hover:bg-muted/50",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground",
                    isDangerZone && "text-red-600 hover:text-red-700 hover:bg-red-50",
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => handleLockedItemClick(e, item.requiredStep, item.href)}
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
                      <p>Unlocks after setup is complete</p>
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