import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Calendar, Bell, BarChart3, FolderOpen, CreditCard, CalendarDays, CalendarRange } from "lucide-react";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Payments", url: "/payments", icon: CreditCard },
];

export function AppSidebar() {
  const { open, setOpen, openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();

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
        <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">
          Sweet Dreams CRM
        </h1>
      </SidebarHeader>

      <SidebarContent className="px-3 flex-1 overflow-y-auto">
        <SidebarMenu>
          {navigationItems
            .slice(0, navigationItems.findIndex((i) => i.title === "Analytics"))
            .map((item) => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-muted"
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
                </SidebarMenuItem>
              );
            })}

          {/* Bookings parent with submenu */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleBookingsClick}
              isActive={isBookingsChildActive}
              className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-muted"
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
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/calendar")}
                      className="group/item w-full h-9 px-3 py-2 mb-1 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-muted"
                    >
                      <NavLink to="/calendar" className="flex items-center gap-3 w-full" onClick={handleNavClick}>
                        <CalendarDays className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                        <span className="font-medium">Calendar</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/sessions")}
                      className="group/item w-full h-9 px-3 py-2 mb-1 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-muted"
                    >
                      <NavLink to="/sessions" className="flex items-center gap-3 w-full" onClick={handleNavClick}>
                        <Calendar className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                        <span className="font-medium">Sessions</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/reminders")}
                      className="group/item w-full h-9 px-3 py-2 mb-1 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-muted"
                    >
                      <NavLink to="/reminders" className="flex items-center gap-3 w-full" onClick={handleNavClick}>
                        <Bell className="h-4 w-4 text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))] group-data-[active=true]/item:text-[hsl(var(--sidebar-primary))]" />
                        <span className="font-medium">Reminders</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
          </SidebarMenuItem>

          {navigationItems
            .slice(navigationItems.findIndex((i) => i.title === "Analytics"))
            .map((item) => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    className="group/item w-full h-10 px-3 py-3 mb-2 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 data-[active=true]:bg-muted"
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
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto shrink-0">
        <div className="flex justify-start">
          <UserMenu mode={isMobile ? "mobile" : "desktop"} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}