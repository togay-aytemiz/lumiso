import { NavLink, Outlet, useLocation } from "react-router-dom";
import { 
  User, 
  Bell, 
  MessageSquare,
  FolderOpen, 
  Users, 
  Package, 
  Plug, 
  FileText, 
  CreditCard,
  Settings as SettingsIcon
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";

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
    label: "Client Messaging",
    path: "/settings/client-messaging",
    icon: MessageSquare
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
    label: "Packages & Services",
    path: "/settings/services",
    icon: Package
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
  const { state } = useSidebar(); // Get main sidebar state
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Calculate positions based on main sidebar state
  const mainSidebarWidth = isMobile ? '3rem' : (state === 'collapsed' ? '3rem' : '16rem');
  const settingsLeft = isMobile ? 'left-12' : (state === 'collapsed' ? 'left-12' : 'left-64');
  const totalMargin = isMobile ? 'ml-28' : (state === 'collapsed' ? 'ml-28' : '');
  const customMargin = !isMobile && state === 'expanded' ? '32rem' : undefined;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Settings Secondary Sidebar - Fixed positioning for mobile, sticky for desktop */}
      <div className={`${isMobile ? 'fixed top-0 left-12 z-20' : 'sticky top-0'} h-screen border-r bg-muted/30 ${isMobile ? 'w-16' : 'w-64'} flex-shrink-0`}>
        <div className={`p-6 ${isMobile ? 'px-3 py-4' : ''} h-full overflow-y-auto`}>
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
      <div className={`flex-1 min-w-0 ${isMobile ? 'ml-28' : ''}`}>
        <Outlet />
      </div>
    </div>
  );
}