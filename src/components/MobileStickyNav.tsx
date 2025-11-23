import React, { useState, useRef, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FolderOpen, Calendar, CalendarDays, Bell, BarChart3, CreditCard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MobileStickyNav() {
  const [bookingsExpanded, setBookingsExpanded] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("navigation");
  const navigationItems = useMemo(
    () => [
      { title: t("menu.dashboard"), url: "/", icon: LayoutDashboard },
      { title: t("menu.leads"), url: "/leads", icon: Users },
      { title: t("menu.analytics"), url: "/analytics", icon: BarChart3 },
      { title: t("menu.payments"), url: "/payments", icon: CreditCard },
    ],
    [t]
  );
  const bookingItems = useMemo(
    () => [
      { title: t("menu.calendar"), url: "/calendar", icon: CalendarDays },
      { title: t("menu.sessions"), url: "/sessions", icon: Calendar },
      { title: t("menu.reminders"), url: "/reminders", icon: Bell },
    ],
    [t]
  );

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
              key={item.url}
              to={item.url}
              aria-label={item.title}
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
          aria-label={t("menu.projects")}
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
            aria-label={t("menu.bookings")}
            aria-expanded={bookingsExpanded}
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
                    key={item.url}
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
              key={item.url}
              to={item.url}
              aria-label={item.title}
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
            aria-label={t("menu.settings")}
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
