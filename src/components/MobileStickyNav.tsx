import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CalendarRange, BarChart3, CreditCard, Settings } from "lucide-react";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Bookings", url: "/calendar", icon: CalendarRange },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileStickyNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    if (path === "/calendar") {
      return currentPath.startsWith("/calendar") || currentPath.startsWith("/sessions") || currentPath.startsWith("/reminders");
    }
    return currentPath.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed left-0 top-0 bottom-0 w-16 bg-[#2a1f5d] z-50 flex flex-col">
      {/* Logo/Brand */}
      <div className="h-16 flex items-center justify-center border-b border-white/10">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col py-4">
        {navigationItems.map((item) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={`h-12 flex items-center justify-center transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}