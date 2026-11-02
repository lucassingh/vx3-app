import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Notifications } from "@/components/layout/notifications";
import { SidebarTrigger } from "@/components/layout/sidebar-trigger";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
      <SidebarTrigger />
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Notifications />
        <span aria-hidden className="mx-2 h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
