import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-surface px-4 py-2 text-sm font-medium shadow-popover focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh">
        <AppSidebar />
        <MobileSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
