import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Bell, Settings, LogOut } from "lucide-react";
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Sessions", url: "/sessions", icon: Calendar },
  { title: "Reminders", url: "/reminders", icon: Bell },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return currentPath === "/" || currentPath === "/dashboard";
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
      className="bg-[#1e1e2f] border-r border-slate-700/50"
      collapsible="icon"
    >
      <SidebarHeader className="p-6">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Sweet Dreams CRM
        </h1>
      </SidebarHeader>

      <SidebarContent className="px-3">
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
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                    }
                  `}
                >
                  <NavLink
                    to={item.url === "/dashboard" ? "/" : item.url}
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

      <SidebarFooter className="p-3">
        <Separator className="mb-3 bg-slate-700" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="w-full h-10 px-3 py-2 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
            >
              <div className="flex items-center gap-3 w-full">
                <Settings className="h-4 w-4" />
                {open && <span className="font-medium">Settings</span>}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="w-full h-10 px-3 py-2 text-slate-300 hover:bg-red-600/20 hover:text-red-200 transition-all duration-200"
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