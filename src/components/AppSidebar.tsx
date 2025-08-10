import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Bell, BarChart3, Settings, LogOut, FolderOpen, CreditCard, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { Separator } from "@/components/ui/separator";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Sessions", url: "/sessions", icon: Calendar },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Reminders", url: "/reminders", icon: Bell },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Payments", url: "/payments", icon: CreditCard },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate("/auth");
  };

  return (
    <Sidebar
      className="bg-[#1e1e2f] border-r border-slate-600 shadow-inner"
      collapsible="icon"
    >
      <SidebarHeader className="p-6 bg-[#1e1e2f]">
        <h1 className="text-xl font-bold text-[#f1f5f9] tracking-tight">
          Sweet Dreams CRM
        </h1>
      </SidebarHeader>

      <SidebarContent className="px-3 bg-[#1e1e2f]">
        <SidebarMenu>
          {navigationItems.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className={`
                    w-full h-10 px-3 py-3 mb-3 text-left transition-all duration-200 rounded-lg
                    ${active
                      ? "bg-blue-500/20 text-blue-100 border-l-4 border-blue-400"
                      : "text-[#f1f5f9] hover:bg-slate-700/50 hover:text-[#f1f5f9]"
                    }
                  `}
                >
                  <NavLink
                    to={item.url}
                    className="flex items-center gap-3 w-full"
                  >
                    <item.icon className="h-4 w-4" />
                    {open && <span className="font-medium">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 bg-[#1e1e2f]">
        <Separator className="mb-3 bg-slate-600" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="w-full h-10 px-3 py-2 text-[#f1f5f9] hover:bg-slate-700/50 hover:text-[#f1f5f9] transition-all duration-200"
            >
              <NavLink
                to="/settings"
                className="flex items-center gap-3 w-full"
              >
                <Settings className="h-4 w-4" />
                {open && <span className="font-medium">Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="w-full h-10 px-3 py-2 text-[#f1f5f9] hover:bg-red-600/20 hover:text-red-200 transition-all duration-200"
            >
              <div className="flex items-center gap-3 w-full">
                <LogOut className="h-4 w-4" />
                {open && <span className="font-medium">Sign Out</span>}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}