import { NavLink, useLocation, Outlet } from "react-router-dom";
import { 
  User, 
  Bell, 
  Settings, 
  Users, 
  MessageSquare, 
  FolderOpen, 
  UserCheck, 
  Package, 
  Plug, 
  FileText, 
  CreditCard, 
  AlertTriangle 
} from "lucide-react";
import { cn } from "@/lib/utils";

const personalSettingsItems = [
  { title: "Profile", href: "/settings/profile", icon: User, testId: "profile-section" },
  { title: "Notifications", href: "/settings/notifications", icon: Bell, testId: "notifications-section" },
];

const organizationSettingsItems = [
  { title: "General", href: "/settings/general", icon: Settings, testId: "general-section" },
  { title: "Team Management", href: "/settings/team", icon: Users, testId: "team-section" },
  { title: "Client Messaging", href: "/settings/client-messaging", icon: MessageSquare, testId: "client-messaging-section" },
  { title: "Projects & Sessions", href: "/settings/projects", icon: FolderOpen, testId: "projects-section" },
  { title: "Lead Management", href: "/settings/leads", icon: UserCheck, testId: "leads-section" },
  { title: "Packages & Services", href: "/settings/services", icon: Package, testId: "services-section" },
  { title: "Integrations", href: "/settings/integrations", icon: Plug, testId: "integrations-section" },
  { title: "Contracts", href: "/settings/contracts", icon: FileText, testId: "contracts-section" },
  { title: "Billing & Payments", href: "/settings/billing", icon: CreditCard, testId: "billing-section" },
  { title: "Danger Zone", href: "/settings/danger-zone", icon: AlertTriangle, testId: "danger-section" },
];

export default function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Settings Navigation - Left sidebar for all screen sizes */}
      <div className="w-16 md:w-80 border-r bg-muted/10 flex-shrink-0">
        <div className="p-2 md:p-6">
          <h2 className="text-xl font-bold mb-6 hidden md:block">Settings</h2>
          
          {/* Personal Settings */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 hidden md:block">
              Personal Settings
            </h3>
            <nav className="space-y-1">
              {personalSettingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    data-walkthrough={item.testId}
                    className={cn(
                      "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start",
                      "hover:bg-muted/50",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="hidden md:block">{item.title}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Organization Settings */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 hidden md:block">
              Organization Settings
            </h3>
            <nav className="space-y-1">
              {organizationSettingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    data-walkthrough={item.testId}
                    className={cn(
                      "flex items-center gap-4 px-2 md:px-4 py-3 text-sm rounded-lg transition-colors justify-center md:justify-start",
                      "hover:bg-muted/50",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:text-foreground",
                      item.title === "Danger Zone" && "text-red-600 hover:text-red-700 hover:bg-red-50"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      item.title === "Danger Zone" && "text-red-600"
                    )} />
                    <span className="hidden md:block">{item.title}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}