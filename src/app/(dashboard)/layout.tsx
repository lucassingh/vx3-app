import { Suspense } from "react";
import { DemoDataProvider } from "@/components/layout/demo-data";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { Topbar } from "@/components/layout/topbar";
import { ROL } from "@/components/plataforma/shared";
import { realDomains } from "@/lib/api/dispatch";
import { API_DOMAINS } from "@/lib/api/domains";
import { CurrentUserProvider } from "@/lib/auth";
import { requireUser } from "@/modules/platform/auth/session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // La sesión se lee en cada request: con cacheComponents, va dentro de un Suspense.
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Mientras quede algún dominio simulado, la barra lateral lo avisa.
  const datosDeDemostracion = realDomains().length < API_DOMAINS.length;

  return (
    <CurrentUserProvider user={{ ...user, roleLabel: ROL[user.role] }}>
      <DemoDataProvider value={datosDeDemostracion}>
        <SidebarProvider>
          <a
            href="#main-content"
            className="sr-only rounded-lg bg-surface px-4 py-2 text-sm font-medium shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
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
      </DemoDataProvider>
    </CurrentUserProvider>
  );
}
