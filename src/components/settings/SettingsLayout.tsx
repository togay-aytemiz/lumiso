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
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { useSettingsNavigation } from "@/hooks/useSettingsNavigation";
import { useToast } from "@/hooks/use-toast";

const personalSettingsItems = [
  { title: "profile", href: "/settings/profile", icon: User, testId: "profile-section" },
  { title: "notifications", href: "/settings/notifications", icon: Bell, testId: "notifications-section" },
];

const organizationSettingsItems = [
  { title: "general", href: "/settings/general", icon: Settings, testId: "general-section" },
  { title: "projects", href: "/settings/projects", icon: FolderOpen, testId: "projects-section" },
  { title: "leads", href: "/settings/leads", icon: UserCheck, testId: "leads-section" },
  { title: "services", href: "/settings/services", icon: Package, testId: "services-section" },
  { title: "contracts", href: "/settings/contracts", icon: FileText, testId: "contracts-section" },
  { title: "billing", href: "/settings/billing", icon: CreditCard, testId: "billing-section" },
  { title: "dangerZone", href: "/settings/danger-zone", icon: AlertTriangle, testId: "danger-section" },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { hasCategoryChanges, cancelCategoryChanges, saveCategoryChanges } = useSettingsContext();
  const { shouldLockNavigation } = useOnboarding();
  const { t } = useTranslation('navigation');
  const { toast } = useToast();
  const currentPath = location.pathname;
  const hasChanges = hasCategoryChanges(currentPath);

  const {
    showGuard,
    message: guardMessage,
    handleNavigationAttempt,
    handleDiscardChanges,
    handleStayOnPage,
    handleSaveAndExit
  } = useSettingsNavigation({
    isDirty: hasChanges,
    onDiscard: () => {
      cancelCategoryChanges(currentPath);
      toast({
        title: "Changes discarded",
        description: "Your unsaved changes have been discarded.",
      });
    },
    onSaveAndExit: async () => {
      await saveCategoryChanges(currentPath);
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
      });
    }
  });
  
  const isItemLocked = (itemHref: string) => {
    // Settings navigation lock check for guided setup
    if (shouldLockNavigation) {
      const isUnlocked = itemHref === '/settings';
      return !isUnlocked;
    }
    
    // Not in guided setup - everything is unlocked
    return false;
  };

  const handleNavItemInteraction = (e: React.MouseEvent, itemHref: string) => {
    if (isItemLocked(itemHref)) {
      e.preventDefault();
      return;
    }

    if (!handleNavigationAttempt(itemHref)) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Settings Navigation - Left sidebar for all screen sizes */}
      <div className="w-16 md:w-80 border-r bg-muted/10 flex-shrink-0">
        <div className="p-2 md:p-6">
          <h2 className="text-xl font-bold mb-6 hidden md:block">{t('settings.title')}</h2>
          
          {/* Personal Settings */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 hidden md:block">
              {t('settings.personalSettings')}
            </h3>
            <nav className="space-y-1">
              {personalSettingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                const hasChanges = hasCategoryChanges(item.href);
                const locked = isItemLocked(item.href);
                
                const linkContent = (
                <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative group",
                    "hover:bg-sidebar-accent",
                    isActive 
                      ? "bg-sidebar-active text-sidebar-active-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground",
                    locked && "opacity-50 cursor-not-allowed"
                  )}>
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors group-hover:text-sidebar-primary",
                    isActive && "text-[hsl(var(--sidebar-active-icon))]"
                  )} />
                  <span className="hidden md:flex md:items-center md:gap-2">
                    {t(`settings.${item.title}`)}
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
                      <div
                        data-walkthrough={item.testId}
                        onClick={(e) => handleNavItemInteraction(e, item.href)}
                      >
                        {linkContent}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('settings.completeGuidedSetup')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    data-walkthrough={item.testId}
                    onClick={(e) => handleNavItemInteraction(e, item.href)}
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
              {t('settings.organizationSettings')}
            </h3>
            <nav className="space-y-1">
              {organizationSettingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                const hasChanges = hasCategoryChanges(item.href);
                const locked = isItemLocked(item.href);
                const isDangerZone = item.title === "dangerZone";
                
                const linkContent = (
                <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative group",
                    !isDangerZone && "hover:bg-sidebar-accent",
                    isActive 
                      ? "bg-sidebar-active text-sidebar-active-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground",
                    isDangerZone && "text-red-600 hover:text-red-700 hover:bg-red-50",
                    locked && "opacity-50 cursor-not-allowed"
                  )}>
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    !isDangerZone && "group-hover:text-sidebar-primary",
                    !isDangerZone && isActive && "text-[hsl(var(--sidebar-active-icon))]",
                    isDangerZone && "text-red-600"
                  )} />
                  <span className="hidden md:flex md:items-center md:gap-2">
                    {t(`settings.${item.title}`)}
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
                      <div
                        data-walkthrough={item.testId}
                        onClick={(e) => handleNavItemInteraction(e, item.href)}
                      >
                        {linkContent}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('settings.completeGuidedSetup')}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    data-walkthrough={item.testId}
                    onClick={(e) => handleNavItemInteraction(e, item.href)}
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

      <NavigationGuardDialog
        open={showGuard}
        onDiscard={handleDiscardChanges}
        onStay={handleStayOnPage}
        onSaveAndExit={handleSaveAndExit}
        message={guardMessage}
      />
    </div>
  );
}
