import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {/* Hide mobile sidebar trigger since we now use bottom nav */}
          <div className="hidden md:block p-2">
            <SidebarTrigger />
          </div>
          <div className="flex-1 pb-24 md:pb-0">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}