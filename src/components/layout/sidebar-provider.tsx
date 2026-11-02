"use client";

import { MotionConfig } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
} from "@/lib/preferences";

const DESKTOP_QUERY = "(min-width: 64rem)";

type SidebarContextValue = {
  /** Aside reducido a íconos (solo desktop). */
  collapsed: boolean;
  /** Drawer abierto (solo mobile). */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** Colapsa el aside en desktop o abre el drawer en mobile. */
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      setSidebarCollapsed(!getSidebarCollapsed());
    } else {
      setMobileOpen((open) => !open);
    }
  }, []);

  // Atajo de teclado: ⌘B / Ctrl+B.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Si la ventana pasa a desktop con el drawer abierto, se cierra.
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(
    () => ({ collapsed, mobileOpen, setMobileOpen, toggle }),
    [collapsed, mobileOpen, toggle],
  );

  return (
    <SidebarContext value={value}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={250} skipDelayDuration={400} disableHoverableContent>
          {children}
        </TooltipProvider>
      </MotionConfig>
    </SidebarContext>
  );
}

export function useSidebar() {
  const context = use(SidebarContext);
  if (!context) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>.");
  return context;
}
