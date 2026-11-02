"use client";

import { PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { Button } from "@/components/ui/button";
import { Kbd, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Botón de la navbar: colapsa el aside (desktop) o abre el drawer (mobile). */
export function SidebarTrigger() {
  const { collapsed, mobileOpen, toggle } = useSidebar();

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={toggle}
        aria-label="Abrir menú de navegación"
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
      >
        <PanelLeft />
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
          >
            <PanelLeftClose className="sidebar-collapsed:hidden" />
            <PanelLeftOpen className="hidden sidebar-collapsed:block" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {collapsed ? "Expandir menú" : "Contraer menú"}
          <ShortcutHint />
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function ShortcutHint() {
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return <Kbd>{isMac ? "⌘B" : "Ctrl B"}</Kbd>;
}
