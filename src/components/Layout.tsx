import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, isMobile]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 pb-24 md:pb-0 min-w-0">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}