import React, { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FolderOpen, CalendarRange, Calendar, CalendarDays, Bell, BarChart3, CreditCard, Settings, ChevronUp } from "lucide-react";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Payments", url: "/payments", icon: CreditCard },
];

const bookingItems = [
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Sessions", url: "/sessions", icon: Calendar },
  { title: "Reminders", url: "/reminders", icon: Bell },
];

export function MobileStickyNav() {
  const [bookingsExpanded, setBookingsExpanded] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setBookingsExpanded(false);
      }
    };

    if (bookingsExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [bookingsExpanded]);

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isBookingsActive = ["/calendar", "/sessions", "/reminders"].some((path) =>
    currentPath.startsWith(path)
  );

  const getCurrentBookingIcon = () => {
    if (currentPath.startsWith("/sessions")) return Calendar;
    if (currentPath.startsWith("/reminders")) return Bell;
    return CalendarDays; // default to calendar
  };

  return (
    <nav className="md:hidden fixed left-0 top-0 bottom-0 w-16 bg-primary z-50 flex flex-col">
      {/* Logo/Brand */}
      <div className="h-16 flex items-center justify-center border-b border-primary-foreground/10">
        <div className="w-8 h-8 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">S</span>
        </div>
      </div>

      {/* Navigation Items - First Part */}
      <div className="flex-1 flex flex-col py-4 relative">
        {navigationItems.slice(0, 2).map((item) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={`h-12 flex items-center justify-center transition-colors ${
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              }`}
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          );
        })}

        {/* Projects */}
        <NavLink
          to="/projects"
          className={`h-12 flex items-center justify-center transition-colors ${
            isActive("/projects")
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          }`}
        >
          <FolderOpen className="h-5 w-5" />
        </NavLink>

        {/* Bookings Menu with Expandable Options */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setBookingsExpanded(!bookingsExpanded)}
            className={`h-12 w-full flex items-center justify-center transition-colors ${
              isBookingsActive
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            }`}
          >
            {React.createElement(getCurrentBookingIcon(), { className: "h-5 w-5" })}
          </button>

          {/* Expandable Bookings Menu */}
          {bookingsExpanded && (
            <div className="absolute left-16 top-0 bg-primary border border-primary-foreground/20 rounded-lg shadow-lg">
              {bookingItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    onClick={() => setBookingsExpanded(false)}
                    className={`flex items-center gap-3 px-4 py-3 min-w-[120px] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation Items - Second Part */}
        {navigationItems.slice(2).map((item) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={`h-12 flex items-center justify-center transition-colors ${
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              }`}
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          );
        })}

        {/* Settings at bottom */}
        <div className="mt-auto">
          <NavLink
            to="/settings"
            className={`h-12 flex items-center justify-center transition-colors ${
              isActive("/settings")
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            }`}
          >
            <Settings className="h-5 w-5" />
          </NavLink>
        </div>
      </div>
    </nav>
  );
}