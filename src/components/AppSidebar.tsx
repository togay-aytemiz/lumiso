import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
  FileText,
  Zap
} from "lucide-react";
import logo from "@/assets/Logo.png";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/UserMenu";
import { SidebarCategory } from "@/components/sidebar/SidebarCategory";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { SidebarSubItem } from "@/components/sidebar/SidebarSubItem";
import { HelpModal } from "@/components/modals/HelpModal";

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
  const { shouldLockNavigation, loading } = useOnboardingV2();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Mobile sheet states
  const [bookingsSheetOpen, setBookingsSheetOpen] = useState(false);
  const [automationSheetOpen, setAutomationSheetOpen] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🚨 SIDEBAR STATE CHANGE:', {
      shouldLockNavigation,
      loading,
      currentPath: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [shouldLockNavigation, loading, location.pathname]);

  // Show loading state while onboarding data is being fetched
  if (loading) {
    console.log('⏳ AppSidebar: Still loading onboarding state...');
  }

  // Helper function to check if item should be visible based on permissions
  const isItemVisible = (requiredPermissions: string[] = []): boolean => {
    if (permissionsLoading) return true; // Show items while loading
    if (requiredPermissions.length === 0) return true; // No permissions required
    return requiredPermissions.some(permission => hasPermission(permission));
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isBookingsChildActive = ["/calendar", "/sessions", "/reminders"].some((path) =>
    currentPath.startsWith(path)
  );
  const [bookingsOpen, setBookingsOpen] = useState(isBookingsChildActive);

  const isAutomationChildActive = ["/workflows", "/templates"].some((path) =>
    currentPath.startsWith(path)
  );
  const [automationOpen, setAutomationOpen] = useState(isAutomationChildActive);
  
  const isItemLocked = (itemUrl?: string) => {
    // If on getting-started page - LOCK EVERYTHING
    if (location.pathname === '/getting-started') {
      return true;
    }
    
    // Simple rule: During guided setup, lock everything except settings
    if (shouldLockNavigation) {
      // Settings should always be accessible during guided setup
      if (itemUrl && itemUrl.startsWith('/settings')) {
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
    } else {
      if (!bookingsOpen) {
        setBookingsOpen(true);
        if (!isBookingsChildActive) {
          navigate("/calendar");
        }
      } else {
        setBookingsOpen(false);
      }
    }
  };

  const handleAutomationClick = () => {
    if (isMobile) {
      setAutomationSheetOpen(true);
    } else {
      if (!automationOpen) {
        setAutomationOpen(true);
        if (!isAutomationChildActive) {
          navigate("/workflows");
        }
      } else {
        setAutomationOpen(false);
      }
    }
  };

  // Auto-close/open Bookings based on current route
  useEffect(() => {
    setBookingsOpen(isBookingsChildActive);
  }, [isBookingsChildActive]);

  // Auto-close/open Automation based on current route
  useEffect(() => {
    setAutomationOpen(isAutomationChildActive);
  }, [isAutomationChildActive]);

  const handleNavClick = () => {
    if (isMobile) {
      // Close any open mobile sheets
      setBookingsSheetOpen(false);
      setAutomationSheetOpen(false);
    }
  };

  return (
    <>
      <Sidebar
        className="border-r border-sidebar-border"
        collapsible="icon"
      >
        <SidebarHeader className="p-6">
          <div className="flex items-center">
            <img 
              src={logo} 
              alt="Lumiso CRM" 
              className="h-10 w-auto object-contain"
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 flex-1 overflow-y-auto">
          {/* Getting Started - Always visible when on getting-started page OR in guided setup */}
          {(location.pathname === '/getting-started' || shouldLockNavigation) && (
            <div className="mb-6">
              <SidebarMenu>
                <SidebarNavItem
                  title="Getting Started"
                  url="/getting-started"
                  icon={BookOpen}
                  isActive={isActive("/getting-started")}
                  onClick={handleNavClick}
                />
              </SidebarMenu>
            </div>
          )}

          {/* MODULES Category */}
          <SidebarCategory title="MODULES">
            {moduleItems.map((item) => (
              <SidebarNavItem
                key={item.title}
                title={item.title}
                url={item.url}
                icon={item.icon}
                isActive={isActive(item.url)}
                isLocked={isItemLocked(item.url)}
                onLockedClick={handleLockedItemClick}
                onClick={handleNavClick}
              />
            ))}

            {/* Bookings with submenu */}
            <SidebarNavItem
              title="Bookings"
              icon={CalendarRange}
              isActive={isBookingsChildActive}
              isLocked={isItemLocked('/calendar')}
              onLockedClick={handleLockedItemClick}
              onClick={!isItemLocked('/calendar') ? handleBookingsClick : undefined}
              badge={
                !isItemLocked('/calendar') && !isMobile ? (
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform duration-200 ${
                      bookingsOpen ? 'rotate-180' : 'rotate-0'
                    }`} 
                  />
                ) : undefined
              }
            >
              <div 
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  bookingsOpen && !isItemLocked('/calendar') && !isMobile
                    ? 'max-h-40 opacity-100' 
                    : 'max-h-0 opacity-0'
                }`}
              >
                <SidebarMenu className="space-y-1 pt-1">
                  {bookingItems.map((item) => (
                    <SidebarSubItem
                      key={item.title}
                      title={item.title}
                      url={item.url}
                      icon={item.icon}
                      isActive={isActive(item.url)}
                      isLocked={isItemLocked(item.url)}
                      onLockedClick={handleLockedItemClick}
                      onClick={handleNavClick}
                    />
                  ))}
                </SidebarMenu>
              </div>
            </SidebarNavItem>
          </SidebarCategory>

          {/* TOOLS Category */}
          <div className="mt-6">
            <SidebarCategory title="TOOLS">
              {toolItems.map((item) => {
                // Define required permissions for each tool item
                let requiredPermissions: string[] = [];
                if (item.title === "Analytics") requiredPermissions = ["view_analytics"];
                if (item.title === "Payments") requiredPermissions = ["view_payments"];

                // Only render if user has required permissions
                if (!isItemVisible(requiredPermissions)) return null;

                return (
                  <SidebarNavItem
                    key={item.title}
                    title={item.title}
                    url={item.url}
                    icon={item.icon}
                    isActive={isActive(item.url)}
                    isLocked={isItemLocked(item.url)}
                    onLockedClick={handleLockedItemClick}
                    onClick={handleNavClick}
                  />
                );
              })}

              {/* Only show Automation if user has workflow or template permissions */}
              {isItemVisible(["view_workflows", "manage_workflows", "view_templates", "manage_templates"]) && (
                <SidebarNavItem
                  title="Automation"
                  icon={Zap}
                  isActive={isAutomationChildActive}
                  isLocked={isItemLocked('/workflows')}
                  onLockedClick={handleLockedItemClick}
                  onClick={!isItemLocked('/workflows') ? handleAutomationClick : undefined}
                  badge={
                    !isItemLocked('/workflows') && !isMobile ? (
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform duration-200 ${
                          automationOpen ? 'rotate-180' : 'rotate-0'
                        }`} 
                      />
                    ) : undefined
                  }
                >
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      automationOpen && !isItemLocked('/workflows') && !isMobile
                        ? 'max-h-40 opacity-100' 
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <SidebarMenu className="space-y-1 pt-1">
                      {automationItems.map((item) => {
                        // Define required permissions for each automation item
                        let requiredPermissions: string[] = [];
                        if (item.title === "Workflows") requiredPermissions = ["view_workflows", "manage_workflows"];
                        if (item.title === "Templates") requiredPermissions = ["view_templates", "manage_templates"];

                        // Only render if user has required permissions
                        if (!isItemVisible(requiredPermissions)) return null;

                        return (
                          <SidebarSubItem
                            key={item.title}
                            title={item.title}
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
              )}
            </SidebarCategory>
          </div>

          {/* SYSTEM Category */}
          <div className="mt-6">
            <SidebarCategory title="SYSTEM">
              {/* Only show Settings if user has any settings permissions */}
              {isItemVisible([
                'view_organization_settings', 'manage_organization_settings',
                'view_services', 'manage_services', 'view_packages', 'manage_packages',
                'view_project_statuses', 'manage_project_statuses',
                'view_project_types', 'manage_project_types',
                'view_session_statuses', 'manage_session_statuses',
                'manage_team', 'manage_roles'
              ]) && (
                <SidebarNavItem
                  title="Settings"
                  url="/settings"
                  icon={Settings}
                  isActive={isActive("/settings")}
                  isLocked={isItemLocked("/settings")}
                  onLockedClick={handleLockedItemClick}
                  onClick={handleNavClick}
                />
              )}
              <SidebarNavItem
                title="Help & Support"
                icon={HelpCircle}
                onClick={() => setHelpModalOpen(true)}
              />
            </SidebarCategory>
          </div>
        </SidebarContent>

        <SidebarFooter className="p-4 mt-auto shrink-0">
          {!shouldLockNavigation && !location.pathname.startsWith('/getting-started') && (
            <UserMenu variant="sidebar" />
          )}
        </SidebarFooter>
      </Sidebar>

      <HelpModal 
        isOpen={helpModalOpen} 
        onOpenChange={setHelpModalOpen} 
      />

      {/* Mobile Sheets */}
      <Sheet open={bookingsSheetOpen} onOpenChange={setBookingsSheetOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>Bookings</SheetTitle>
          </SheetHeader>
          <div className="px-3">
            <SidebarMenu className="space-y-1">
              {bookingItems.map((item) => (
                <SidebarSubItem
                  key={item.title}
                  title={item.title}
                  url={item.url}
                  icon={item.icon}
                  isActive={isActive(item.url)}
                  isLocked={isItemLocked(item.url)}
                  onLockedClick={handleLockedItemClick}
                  onClick={handleNavClick}
                />
              ))}
            </SidebarMenu>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={automationSheetOpen} onOpenChange={setAutomationSheetOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>Automation</SheetTitle>
          </SheetHeader>
          <div className="px-3">
            <SidebarMenu className="space-y-1">
              {automationItems.map((item) => {
                // Define required permissions for each automation item
                let requiredPermissions: string[] = [];
                if (item.title === "Workflows") requiredPermissions = ["view_workflows", "manage_workflows"];
                if (item.title === "Templates") requiredPermissions = ["view_templates", "manage_templates"];

                // Only render if user has required permissions
                if (!isItemVisible(requiredPermissions)) return null;

                return (
                  <SidebarSubItem
                    key={item.title}
                    title={item.title}
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