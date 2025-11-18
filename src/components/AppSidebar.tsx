import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Bell,
  BarChart3,
  FolderOpen,
  CreditCard,
  CalendarDays,
  CalendarRange,
  BookOpen,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronLeft,
  FileText,
  Zap,
  Shield,
} from "lucide-react";
import logo from "@/assets/Logo.png";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/UserMenu";
import { SidebarCategory } from "@/components/sidebar/SidebarCategory";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { SidebarSubItem } from "@/components/sidebar/SidebarSubItem";
import { TrialStatusIndicator } from "@/components/sidebar/TrialStatusIndicator";
import { HelpModal } from "@/components/modals/HelpModal";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigationTranslation } from "@/hooks/useTypedTranslation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// Module items - main navigation
const moduleItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderOpen },
];

// Tools items - analytics and financial
const toolItems = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Payments", url: "/payments", icon: CreditCard },
];

// Bookings sub-items
const bookingItems = [
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Sessions", url: "/sessions", icon: Calendar },
  { title: "Reminders", url: "/reminders", icon: Bell },
];

// Automation sub-items
const automationItems = [
  { title: "Workflows", url: "/workflows", icon: BarChart3 },
  { title: "Templates", url: "/templates", icon: FileText },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const { shouldLockNavigation, loading } = useOnboarding();
  const { isAdminOrSupport } = useUserRole();
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const { t } = useNavigationTranslation();
  const { t: tCommon } = useTranslation("common");
  const settingsLinkState =
    !isMobile && !currentPath.startsWith("/settings")
      ? { backgroundLocation: location }
      : undefined;
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";

  // Mobile sheet states
  const [bookingsSheetOpen, setBookingsSheetOpen] = useState(false);
  const [automationSheetOpen, setAutomationSheetOpen] = useState(false);

  // Show loading state while onboarding data is being fetched
  if (loading) {
    // Removed console.log spam
  }

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isBookingsChildActive = ["/calendar", "/sessions", "/reminders"].some(
    (path) => currentPath.startsWith(path)
  );
  const [bookingsOpen, setBookingsOpen] = useState(isBookingsChildActive);

  const isAutomationChildActive = ["/workflows", "/templates"].some((path) =>
    currentPath.startsWith(path)
  );
  const [automationOpen, setAutomationOpen] = useState(isAutomationChildActive);

  const isItemLocked = (itemUrl?: string) => {
    // If on getting-started page - LOCK EVERYTHING
    if (location.pathname === "/getting-started") {
      return true;
    }

    // Simple rule: During guided setup, lock everything except settings
    if (shouldLockNavigation) {
      // Settings should always be accessible during guided setup
      if (itemUrl && itemUrl.startsWith("/settings")) {
        return false;
      }
      return true;
    }

    // Not in guided setup - everything is unlocked
    return false;
  };

  const handleLockedItemClick = (e: React.MouseEvent) => {
    if (shouldLockNavigation) {
      e.preventDefault();
    }
  };

  const handleBookingsClick = () => {
    if (isMobile) {
      setBookingsSheetOpen(true);
      return;
    }

    if (!bookingsOpen) {
      setBookingsOpen(true);
      if (!isBookingsChildActive) {
        navigate("/calendar");
      }
    } else {
      setBookingsOpen(false);
    }
  };

  const handleAutomationClick = () => {
    if (isMobile) {
      setAutomationSheetOpen(true);
      return;
    }

    if (!automationOpen) {
      setAutomationOpen(true);
      if (!isAutomationChildActive) {
        navigate("/workflows");
      }
    } else {
      setAutomationOpen(false);
    }
  };

  const handleNavClick = () => {
    if (isMobile) {
      setBookingsSheetOpen(false);
      setAutomationSheetOpen(false);
    }
  };

  const handleSettingsNav = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    if (settingsLinkState) {
      navigate("/settings/profile", { state: settingsLinkState });
    } else {
      navigate("/settings/profile");
    }
    handleNavClick();
  };

  // Auto-close/open Bookings based on current route
  useEffect(() => {
    setBookingsOpen(isBookingsChildActive);
  }, [isBookingsChildActive]);

  // Auto-close/open Automation based on current route
  useEffect(() => {
    setAutomationOpen(isAutomationChildActive);
  }, [isAutomationChildActive]);

  return (
    <>
      <Sidebar
        className="border-r border-border/60 [&_[data-sidebar=sidebar]]:!rounded-l-none [&_[data-sidebar=sidebar]]:!rounded-bl-none [&_[data-sidebar=sidebar]]:!rounded-tl-none"
        collapsible="icon"
      >
        <SidebarHeader className="p-6 pb-4 transition-[padding] duration-300 group-data-[collapsible=icon]:p-3">
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:hidden">
              <img
                src={logo}
                alt="Lumiso CRM"
                className="h-10 w-auto object-contain transition-opacity group-data-[collapsible=icon]:hidden"
              />
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[hsl(var(--sidebar-primary))] bg-transparent text-[hsl(var(--sidebar-primary))] transition-all duration-300 hover:translate-x-[2px] hover:bg-[hsl(var(--sidebar-primary)_/_0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sidebar-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-background group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-12 group-data-[collapsible=icon]:hover:translate-x-0 group-data-[collapsible=icon]:focus-visible:translate-x-0"
              aria-label={tCommon("sidebar.toggle")}
              title={tCommon("sidebar.toggle")}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform duration-300 group-data-[collapsible=icon]:size-5",
                  isCollapsed && "rotate-180"
                )}
              />
              <span className="sr-only">{tCommon("sidebar.toggle")}</span>
            </button>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 flex-1 overflow-y-auto group-data-[collapsible=icon]:px-1.5">
          {/* Getting Started - Always visible when on getting-started page OR in guided setup */}
          {(location.pathname === "/getting-started" ||
            shouldLockNavigation) && (
            <div className="mb-6">
              <SidebarMenu>
                <SidebarNavItem
                  title={t("menu.getting_started")}
                  url="/getting-started"
                  icon={BookOpen}
                  isActive={isActive("/getting-started")}
                  onClick={handleNavClick}
                />
              </SidebarMenu>
            </div>
          )}

          {/* MODULES Category */}
          <SidebarCategory title={t("sections.main")}>
            {moduleItems.map((item) => {
              let translationKey: string;
              switch (item.title) {
                case "Dashboard":
                  translationKey = t("menu.dashboard");
                  break;
                case "Leads":
                  translationKey = t("menu.leads");
                  break;
                case "Projects":
                  translationKey = t("menu.projects");
                  break;
                default:
                  translationKey = item.title;
              }

              return (
                <SidebarNavItem
                  key={item.title}
                  title={translationKey}
                  url={item.url}
                  icon={item.icon}
                  isActive={isActive(item.url)}
                  isLocked={isItemLocked(item.url)}
                  onLockedClick={handleLockedItemClick}
                  onClick={handleNavClick}
                />
              );
            })}

            {/* Bookings with submenu */}
            <SidebarNavItem
              title={t("menu.sessions")}
              icon={CalendarRange}
              isActive={isBookingsChildActive}
              isLocked={isItemLocked("/calendar")}
              onLockedClick={handleLockedItemClick}
              onClick={
                !isItemLocked("/calendar") ? handleBookingsClick : undefined
              }
              badge={
                !isItemLocked("/calendar") && !isMobile ? (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      bookingsOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                ) : undefined
              }
              collapsedItems={bookingItems.map((item) => {
                let translationKey: string;
                switch (item.title) {
                  case "Calendar":
                    translationKey = t("menu.calendar");
                    break;
                  case "Sessions":
                    translationKey = t("menu.sessions");
                    break;
                  case "Reminders":
                    translationKey = t("menu.reminders");
                    break;
                  default:
                    translationKey = item.title;
                }

                return {
                  title: translationKey,
                  url: item.url,
                  icon: item.icon,
                  isActive: isActive(item.url),
                  isLocked: isItemLocked(item.url),
                  onLockedClick: handleLockedItemClick,
                  onClick: handleNavClick,
                };
              })}
            >
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  bookingsOpen && !isItemLocked("/calendar") && !isMobile
                    ? "max-h-40 opacity-100"
                    : "max-h-0 opacity-0"
                } group-data-[collapsible=icon]:hidden`}
              >
                <SidebarMenu className="space-y-0.5 pt-1">
                  {bookingItems.map((item) => {
                    let translationKey: string;
                    switch (item.title) {
                      case "Calendar":
                        translationKey = t("menu.calendar");
                        break;
                      case "Sessions":
                        translationKey = t("menu.sessions");
                        break;
                      case "Reminders":
                        translationKey = t("menu.reminders");
                        break;
                      default:
                        translationKey = item.title;
                    }

                    return (
                      <SidebarSubItem
                        key={item.title}
                        title={translationKey}
                        url={item.url}
                        icon={item.icon}
                        isActive={isActive(item.url)}
                        isLocked={isItemLocked(item.url)}
                        onLockedClick={handleLockedItemClick}
                        onClick={handleNavClick}
                      />
                    );
                  })}
                </SidebarMenu>
              </div>
            </SidebarNavItem>
          </SidebarCategory>

          <SidebarSeparator className="my-4 opacity-70 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8" />

          {/* TOOLS Category */}
          <SidebarCategory title={t("sections.tools")}>
            {toolItems.map((item) => {
              let translationKey: string;
              switch (item.title) {
                case "Analytics":
                  translationKey = t("menu.analytics");
                  break;
                case "Payments":
                  translationKey = t("menu.payments");
                  break;
                default:
                  translationKey = item.title;
              }

              return (
                <SidebarNavItem
                  key={item.title}
                  title={translationKey}
                  url={item.url}
                  icon={item.icon}
                  isActive={isActive(item.url)}
                  isLocked={isItemLocked(item.url)}
                  onLockedClick={handleLockedItemClick}
                  onClick={handleNavClick}
                />
              );
            })}

            <SidebarNavItem
              title={t("menu.workflows")}
              icon={Zap}
              isActive={isAutomationChildActive}
              isLocked={isItemLocked("/workflows")}
              onLockedClick={handleLockedItemClick}
              onClick={
                !isItemLocked("/workflows")
                  ? handleAutomationClick
                  : undefined
              }
              badge={
                !isItemLocked("/workflows") && !isMobile ? (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      automationOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                ) : undefined
              }
              collapsedItems={automationItems.map((item) => {
                let translationKey: string;
                switch (item.title) {
                  case "Workflows":
                    translationKey = t("menu.workflows");
                    break;
                  case "Templates":
                    translationKey = t("menu.templates");
                    break;
                  default:
                    translationKey = item.title;
                }

                return {
                  title: translationKey,
                  url: item.url,
                  icon: item.icon,
                  isActive: isActive(item.url),
                  isLocked: isItemLocked(item.url),
                  onLockedClick: handleLockedItemClick,
                  onClick: handleNavClick,
                };
              })}
            >
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  automationOpen && !isItemLocked("/workflows") && !isMobile
                    ? "max-h-40 opacity-100"
                    : "max-h-0 opacity-0"
                } group-data-[collapsible=icon]:hidden`}
              >
                <SidebarMenu className="space-y-0.5 pt-1">
                  {automationItems.map((item) => {
                    let translationKey: string;
                    switch (item.title) {
                      case "Workflows":
                        translationKey = t("menu.workflows");
                        break;
                      case "Templates":
                        translationKey = t("menu.templates");
                        break;
                      default:
                        translationKey = item.title;
                    }

                    return (
                      <SidebarSubItem
                        key={item.title}
                        title={translationKey}
                        url={item.url}
                        icon={item.icon}
                        isActive={isActive(item.url)}
                        isLocked={isItemLocked(item.url)}
                        onLockedClick={handleLockedItemClick}
                        onClick={handleNavClick}
                      />
                    );
                  })}
                </SidebarMenu>
              </div>
            </SidebarNavItem>
          </SidebarCategory>

          <SidebarSeparator className="my-4 opacity-70 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8" />

          {/* SYSTEM Category */}
          <SidebarCategory title={t("sections.system")}>
            <SidebarNavItem
              title={t("menu.settings")}
              url="/settings/profile"
              state={settingsLinkState}
              icon={Settings}
              isActive={isActive("/settings")}
              isLocked={isItemLocked("/settings")}
              onLockedClick={handleLockedItemClick}
              onClick={handleSettingsNav}
            />
            <SidebarNavItem
              title={t("menu.help")}
              icon={HelpCircle}
              onClick={() => setHelpModalOpen(true)}
            />
            {/* Administration - Only for admin/support users */}
            {isAdminOrSupport() && (
              <SidebarNavItem
                title={t("menu.administration")}
                url="/admin"
                icon={Shield}
                isActive={isActive("/admin")}
                isLocked={isItemLocked("/admin")}
                onLockedClick={handleLockedItemClick}
                onClick={handleNavClick}
              />
            )}
          </SidebarCategory>
        </SidebarContent>

        <SidebarFooter className="p-4 mt-auto shrink-0 space-y-3">
          <TrialStatusIndicator />
          {isMobile &&
            !shouldLockNavigation &&
            !location.pathname.startsWith("/getting-started") && (
              <UserMenu variant="sidebar" />
            )}
        </SidebarFooter>
      </Sidebar>

      <HelpModal isOpen={helpModalOpen} onOpenChange={setHelpModalOpen} />

      {/* Mobile Sheets */}
      <Sheet open={bookingsSheetOpen} onOpenChange={setBookingsSheetOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>{t("mobile_sheets.bookings")}</SheetTitle>
          </SheetHeader>
          <div className="px-3">
            <SidebarMenu className="space-y-0.5">
              {bookingItems.map((item) => {
                let translationKey: string;
                switch (item.title) {
                  case "Calendar":
                    translationKey = t("menu.calendar");
                    break;
                  case "Sessions":
                    translationKey = t("menu.sessions");
                    break;
                  case "Reminders":
                    translationKey = t("menu.reminders");
                    break;
                  default:
                    translationKey = item.title;
                }

                return (
                  <SidebarSubItem
                    key={item.title}
                    title={translationKey}
                    url={item.url}
                    icon={item.icon}
                    isActive={isActive(item.url)}
                    isLocked={isItemLocked(item.url)}
                    onLockedClick={handleLockedItemClick}
                    onClick={handleNavClick}
                  />
                );
              })}
            </SidebarMenu>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={automationSheetOpen} onOpenChange={setAutomationSheetOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>{t("mobile_sheets.automation")}</SheetTitle>
          </SheetHeader>
          <div className="px-3">
            <SidebarMenu className="space-y-0.5">
              {automationItems.map((item) => {
                let translationKey: string;
                switch (item.title) {
                  case "Workflows":
                    translationKey = t("menu.workflows");
                    break;
                  case "Templates":
                    translationKey = t("menu.templates");
                    break;
                  default:
                    translationKey = item.title;
                }

                return (
                  <SidebarSubItem
                    key={item.title}
                    title={translationKey}
                    url={item.url}
                    icon={item.icon}
                    isActive={isActive(item.url)}
                    isLocked={isItemLocked(item.url)}
                    onLockedClick={handleLockedItemClick}
                    onClick={handleNavClick}
                  />
                );
              })}
            </SidebarMenu>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
