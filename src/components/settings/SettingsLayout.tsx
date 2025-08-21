import { NavLink, useLocation, Outlet } from "react-router-dom";
import { User, Building, Bell, CreditCard, Users, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNavItems = [
  { title: "Profile", href: "/settings/profile", icon: User, testId: "profile-section" },
  { title: "General", href: "/settings/general", icon: Building, testId: "general-section" },
  { title: "Notifications", href: "/settings/notifications", icon: Bell, testId: "notifications-section" },
  { title: "Services", href: "/settings/services", icon: CreditCard, testId: "services-section" },
  { title: "Team", href: "/settings/team", icon: Users, testId: "team-section" },
  { title: "Roles", href: "/settings/roles", icon: Shield, testId: "roles-section" },
  { title: "Danger Zone", href: "/settings/danger", icon: Trash2, testId: "danger-section" },
];

export default function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Settings Navigation - Left sidebar for all screen sizes */}
      <div className="w-16 md:w-64 border-r bg-muted/10 flex-shrink-0">
        <div className="p-2 md:p-4">
          <h2 className="text-lg font-semibold mb-4 hidden md:block">Settings</h2>
          <nav className="space-y-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  data-walkthrough={item.testId}
                  className={cn(
                    "flex items-center gap-3 px-2 md:px-3 py-2 text-sm rounded-lg transition-colors justify-center md:justify-start",
                    "hover:bg-muted/50",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden md:block">{item.title}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}