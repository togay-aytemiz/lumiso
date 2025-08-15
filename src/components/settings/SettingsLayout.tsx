import { NavLink, Outlet } from "react-router-dom";
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
  return (
    <div className="flex min-h-screen bg-background">
      {/* Secondary Sidebar */}
      <div className="w-64 border-r bg-muted/30">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Settings</h2>
          <nav className="space-y-1">
            {settingsCategories.map((category) => (
              <NavLink
                key={category.path}
                to={category.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`
                }
              >
                <category.icon className="h-4 w-4" />
                {category.label}
              </NavLink>
            ))}
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