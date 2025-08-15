import { NavLink, Outlet, useLocation } from "react-router-dom";
import { 
  User, 
  Bell, 
  FolderOpen, 
  Users, 
  DollarSign, 
  Plug, 
  FileText, 
  CreditCard,
  Settings as SettingsIcon
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const settingsCategories = [
  {
    label: "General",
    path: "/settings/general",
    icon: SettingsIcon
  },
  {
    label: "Account & Users",
    path: "/settings/account",
    icon: User
  },
  {
    label: "Notifications",
    path: "/settings/notifications",
    icon: Bell
  },
  {
    label: "Projects & Sessions",
    path: "/settings/projects",
    icon: FolderOpen
  },
  {
    label: "Lead Management",
    path: "/settings/leads",
    icon: Users
  },
  {
    label: "Services & Pricing",
    path: "/settings/services",
    icon: DollarSign
  },
  {
    label: "Integrations",
    path: "/settings/integrations",
    icon: Plug
  },
  {
    label: "Contracts",
    path: "/settings/contracts",
    icon: FileText
  },
  {
    label: "Billing & Payments",
    path: "/settings/billing",
    icon: CreditCard
  }
];

export default function SettingsLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Secondary Sidebar */}
      <div className={`border-r bg-muted/30 ${isMobile ? 'w-16' : 'w-64'}`}>
        <div className={`p-6 ${isMobile ? 'px-3 py-4' : ''}`}>
          {!isMobile && (
            <h2 className="text-xl font-semibold mb-6">Settings</h2>
          )}
          <nav className={`space-y-1 ${isMobile ? 'space-y-2' : ''}`}>
            {settingsCategories.map((category) => {
              const active = isActive(category.path);
              return (
                <NavLink
                  key={category.path}
                  to={category.path}
                  className={`group/item w-full h-10 px-3 py-3 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 flex items-center gap-3 ${
                    active
                      ? "bg-muted text-sidebar-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } ${isMobile ? 'justify-center' : ''}`}
                >
                  <category.icon className={`h-4 w-4 transition-colors ${
                    active 
                      ? "text-[hsl(var(--sidebar-primary))]" 
                      : "text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))]"
                  }`} />
                  {!isMobile && (
                    <span className="font-medium text-sm">{category.label}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}