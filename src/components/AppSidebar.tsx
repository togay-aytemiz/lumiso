import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Calendar, Bell, BarChart3, FolderOpen, CreditCard, CalendarDays, CalendarRange, Lock, BookOpen, Settings } from "lucide-react";
import logo from "@/assets/Logo.png";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/UserMenu";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, requiredStep: 6 },
  { title: "Leads", url: "/leads", icon: Users, requiredStep: 2 },
  { title: "Projects", url: "/projects", icon: FolderOpen, requiredStep: 3 },
  { title: "Analytics", url: "/analytics", icon: BarChart3, requiredStep: 6 },
  { title: "Payments", url: "/payments", icon: CreditCard, requiredStep: 6 },
  { title: "Settings", url: "/settings", icon: Settings, requiredStep: 6 },
];

const bookingItems = [
  { title: "Calendar", url: "/calendar", icon: CalendarDays, requiredStep: 4 },
  { title: "Sessions", url: "/sessions", icon: Calendar, requiredStep: 4 },
  { title: "Reminders", url: "/reminders", icon: Bell, requiredStep: 4 },
];

export function AppSidebar() {
  const { open, setOpen, openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const { inGuidedSetup, completedCount, loading } = useOnboarding();

  // Debug logging - CHECK WHAT'S CHANGING
  useEffect(() => {
    console.log('🚨 SIDEBAR STATE CHANGE:', {
      inGuidedSetup,
      completedCount,
      loading,
      currentPath: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [inGuidedSetup, completedCount, loading, location.pathname]);

  // Show loading state while onboarding data is being fetched
  if (loading) {
    console.log('⏳ AppSidebar: Still loading onboarding state...');
  }

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
  
  const isItemLocked = (requiredStep: number) => {
    // SIMPLE RULE: If on getting-started page OR in guided setup - LOCK EVERYTHING
    if (location.pathname === '/getting-started' || inGuidedSetup) {
      return true;
    }
    
    // Normal mode - unlock based on completion
    return completedCount < requiredStep;
  };

  const handleLockedItemClick = (e: React.MouseEvent) => {
    if (inGuidedSetup) {
      e.preventDefault();
    }
  };
  const handleBookingsClick = () => {
    if (!bookingsOpen) {
      setBookingsOpen(true);
      if (!isBookingsChildActive) {
        navigate("/calendar");
      }
    } else {
      setBookingsOpen(false);
    }
  };

  // Auto-close/open Bookings based on current route
  useEffect(() => {
    setBookingsOpen(isBookingsChildActive);
  }, [isBookingsChildActive]);


  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar
      className="border-r border-sidebar-border hidden md:flex"
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
        <SidebarMenu>
          {/* Getting Started - Always visible when on getting-started page OR in guided setup */}
          {(location.pathname === '/getting-started' || inGuidedSetup) && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive("/getting-started")}
                className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
              >
                <NavLink
                  to="/getting-started"
                  className="flex items-center gap-3 w-full"
                  onClick={handleNavClick}
                >
                  <BookOpen className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                  <span className="font-medium">Getting Started</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {navigationItems
            .slice(0, navigationItems.findIndex((i) => i.title === "Analytics"))
            .map((item) => {
              const active = isActive(item.url);
              const locked = isItemLocked(item.requiredStep);
              
              const content = (
                <div 
                  className={`flex items-center gap-3 w-full ${locked ? 'opacity-50' : ''}`}
                  onClick={locked ? handleLockedItemClick : undefined}
                >
                  <item.icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                  <span className="font-medium">{item.title}</span>
                  {locked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                </div>
              );

              return (
                <SidebarMenuItem key={item.title}>
                  {locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg cursor-not-allowed"
                        >
                          {content}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{inGuidedSetup ? 'Complete current tutorial step first' : 'Unlocks after setup is complete'}</p>
                        </TooltipContent>
                    </Tooltip>
                  ) : (
                     <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                    >
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 w-full"
                        onClick={handleNavClick}
                        data-walkthrough={item.title === "Settings" ? "settings-nav" : undefined}
                      >
                        <item.icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}

          {/* Bookings parent with submenu */}
          <SidebarMenuItem>
            {isItemLocked(4) ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg cursor-not-allowed opacity-50"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <CalendarRange className="h-4 w-4 text-sidebar-foreground" />
                      <span className="font-medium">Bookings</span>
                      <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                    </div>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{inGuidedSetup ? 'Complete current tutorial step first' : 'Unlocks after setup is complete'}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <SidebarMenuButton
                  onClick={handleBookingsClick}
                  isActive={isBookingsChildActive}
                  className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                >
                  <div className="flex items-center gap-3 w-full">
                    <CalendarRange className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                    <span className="font-medium">Bookings</span>
                  </div>
                </SidebarMenuButton>

                <div
                  className={`ml-6 overflow-hidden transition-all duration-300 ease-out ${bookingsOpen ? 'mt-1 max-h-40 opacity-100 animate-fade-in' : 'max-h-0 opacity-0'}`}
                  aria-hidden={!bookingsOpen}
                >
                    <SidebarMenu>
                      {bookingItems.map((item) => {
                        const active = isActive(item.url);
                        const locked = isItemLocked(item.requiredStep);
                        
                        return (
                          <SidebarMenuItem key={item.title}>
                            {locked ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SidebarMenuButton
                                    className="group/item w-full h-9 px-3 py-2 mb-1 text-left transition-all duration-200 rounded-lg cursor-not-allowed opacity-50"
                                  >
                                    <div className="flex items-center gap-3 w-full">
                                      <item.icon className="h-4 w-4 text-sidebar-foreground" />
                                      <span className="font-medium">{item.title}</span>
                                      <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                                    </div>
                                  </SidebarMenuButton>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <p>{inGuidedSetup ? 'Complete current tutorial step first' : 'Unlocks after setup is complete'}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <SidebarMenuButton
                                asChild
                                isActive={active}
                                className="group/item w-full h-9 px-3 py-2 mb-1 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                              >
                                <NavLink to={item.url} className="flex items-center gap-3 w-full" onClick={handleNavClick}>
                                  <item.icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                                  <span className="font-medium">{item.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            )}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </div>
              </>
            )}
          </SidebarMenuItem>

          {navigationItems
            .slice(navigationItems.findIndex((i) => i.title === "Analytics"))
            .map((item) => {
              const active = isActive(item.url);
              const locked = isItemLocked(item.requiredStep);
              
              const content = (
                <div 
                  className={`flex items-center gap-3 w-full ${locked ? 'opacity-50' : ''}`}
                  onClick={locked ? handleLockedItemClick : undefined}
                >
                  <item.icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                  <span className="font-medium">{item.title}</span>
                  {locked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                </div>
              );

              return (
                <SidebarMenuItem key={item.title}>
                  {locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg cursor-not-allowed"
                        >
                          {content}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{inGuidedSetup ? 'Complete current tutorial step first' : 'Unlocks after setup is complete'}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                    >
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 w-full"
                        onClick={handleNavClick}
                      >
                        <item.icon className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto shrink-0">
        {!inGuidedSetup && !location.pathname.startsWith('/getting-started') && (
          <div className="flex justify-start">
            <UserMenu mode={isMobile ? "mobile" : "desktop"} />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}