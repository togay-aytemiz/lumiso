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
            "flex-1 min-w-0",                                  // important to prevent right-side gaps
            fullBleed
              ? "pl-6 pr-4 md:pl-8 md:pr-6 lg:pl-12 lg:pr-8"   // more left margin for spacing from sidebar
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