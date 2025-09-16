import { NavLink, useLocation, Outlet, Navigate } from "react-router-dom";
import { 
  Languages,
  Users, 
  Activity,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const adminItems = [
  { title: "Localization", href: "/admin/localization", icon: Languages, testId: "localization-section" },
  { title: "User Management", href: "/admin/users", icon: Users, testId: "users-section" },
  { title: "System Overview", href: "/admin/system", icon: Activity, testId: "system-section" },
];

export default function AdminLayout() {
  const location = useLocation();
  const { isAdminOrSupport } = useUserRole();
  
  // Redirect if user doesn't have admin/support role
  if (!isAdminOrSupport()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Admin Navigation - Left sidebar for all screen sizes */}
      <div className="w-16 md:w-80 border-r bg-muted/10 flex-shrink-0">
        <div className="p-2 md:p-6">
          <h2 className="text-xl font-bold mb-6 hidden md:block">Administration</h2>
          
          {/* System Management */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 hidden md:block">
              System Management
            </h3>
            <nav className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                const linkContent = (
                  <div className={cn(
                    "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start relative group",
                    "hover:bg-sidebar-accent",
                    isActive 
                      ? "bg-sidebar-active text-sidebar-active-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 flex-shrink-0 transition-colors group-hover:text-sidebar-primary",
                      isActive && "text-[hsl(var(--sidebar-active-icon))]"
                    )} />
                    <span className="hidden md:flex md:items-center md:gap-2">
                      {item.title}
                    </span>
                  </div>
                );
                
                return (
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

      {/* Admin Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}