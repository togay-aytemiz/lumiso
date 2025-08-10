import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";

type LayoutProps = {
  children: React.ReactNode;
  fullBleed?: boolean;        // removes max-width container beside sidebar
  contentClassName?: string;  // extra classes for the content wrapper
}

export default function Layout({ children, fullBleed = false, contentClassName }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main
          className={cn(
            "flex-1 min-w-0",
            fullBleed
              ? "px-6 md:px-8 lg:px-12"
              : "container mx-auto max-w-7xl px-4 md:px-6 lg:px-8",
            contentClassName
          )}
        >
          <div className="md:hidden p-2 border-b">
            <SidebarTrigger />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}