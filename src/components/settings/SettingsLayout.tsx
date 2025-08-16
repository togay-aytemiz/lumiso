import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
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
  Settings as SettingsIcon,
  AlertTriangle
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { SettingsProvider, useSettingsContext } from "@/contexts/SettingsContext";
import { NavigationGuardDialog } from "./NavigationGuardDialog";
import { useSettingsNavigation } from "@/hooks/useSettingsNavigation";

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
  },
  {
    label: "Danger Zone",
    path: "/settings/danger-zone",
    icon: AlertTriangle,
    isDanger: true
  }
];

function SettingsLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { state } = useSidebar(); // Get main sidebar state
  const { hasDirtySections, clearAllDirtySections } = useSettingsContext();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const {
    showGuard,
    handleNavigationAttempt,
    handleDiscardChanges,
    handleStayOnPage
  } = useSettingsNavigation({
    isDirty: hasDirtySections,
    onDiscard: clearAllDirtySections
  });

  // Intercept navigation attempts
  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (!handleNavigationAttempt(path)) {
      e.preventDefault();
    }
  };

  // Calculate positions based on main sidebar state
  const mainSidebarWidth = isMobile ? '3rem' : (state === 'collapsed' ? '3rem' : '16rem');
  const settingsLeft = isMobile ? 'left-12' : (state === 'collapsed' ? 'left-12' : 'left-64');
  const totalMargin = isMobile ? 'ml-28' : (state === 'collapsed' ? 'ml-28' : '');
  const customMargin = !isMobile && state === 'expanded' ? '32rem' : undefined;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Settings Secondary Sidebar - Fixed positioning for mobile, sticky for desktop */}
      <div className={`${isMobile ? 'fixed top-0 left-0 z-20' : 'sticky top-0'} h-screen border-r bg-muted/30 ${isMobile ? 'w-16' : 'w-16 md:w-16 lg:w-64'} flex-shrink-0`}>
        <div className={`p-6 ${isMobile ? 'px-3 py-4' : 'px-3 py-4 lg:px-6 lg:py-6'} h-full overflow-y-auto`}>
          <h2 className="text-xl font-semibold mb-6 hidden lg:block">Settings</h2>
          <nav className={`space-y-1 ${isMobile ? 'space-y-2' : 'space-y-2 lg:space-y-1'}`}>
            {settingsCategories.map((category) => {
              const active = isActive(category.path);
              const isDanger = 'isDanger' in category && category.isDanger;
              return (
                <NavLink
                  key={category.path}
                  to={category.path}
                  onClick={(e) => handleNavClick(e, category.path)}
                  className={`group/item w-full h-10 px-3 py-3 text-left transition-all duration-200 rounded-lg hover:bg-muted/50 flex items-center gap-3 relative ${
                    active
                      ? `${isDanger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-sidebar-foreground'}`
                      : `${isDanger ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'}`
                  } ${isMobile ? 'justify-center' : 'justify-center lg:justify-start'}`}
                >
                  <div className="relative flex items-center">
                    <category.icon className={`h-4 w-4 transition-colors ${
                      isDanger
                        ? (active ? "text-destructive" : "text-destructive group-hover/item:text-destructive")
                        : (active 
                            ? "text-[hsl(var(--sidebar-primary))]" 
                            : "text-sidebar-foreground group-hover/item:text-[hsl(var(--sidebar-primary))]")
                    }`} />
                    {/* Dirty indicator for mobile/tablet (icon only view) */}
                    {active && hasDirtySections && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse lg:hidden" />
                    )}
                  </div>
                  <span className="font-medium text-sm hidden lg:flex lg:items-center lg:gap-2">
                    {category.label}
                    {/* Dirty indicator for desktop (text + icon view) */}
                    {active && hasDirtySections && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    )}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 min-w-0 ${isMobile ? 'ml-16' : 'lg:ml-0'}`}>
        <Outlet />
      </div>

      {/* Navigation Guard Dialog */}
      <NavigationGuardDialog
        open={showGuard}
        onDiscard={handleDiscardChanges}
        onStay={handleStayOnPage}
      />
    </div>
  );
}

export default function SettingsLayout() {
  return (
    <SettingsProvider>
      <SettingsLayoutContent />
    </SettingsProvider>
  );
}