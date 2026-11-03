"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";

const iconClass = "transition-[scale,rotate,opacity] duration-300 ease-snappy";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Activar tema claro" : "Activar tema oscuro";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={label}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {/* Ambos íconos se renderizan; el CSS muestra el correcto antes de hidratar. */}
          <Sun data-theme-transition className={`${iconClass} dark:scale-0 dark:-rotate-90 dark:opacity-0`} />
          <Moon
            data-theme-transition
            className={`${iconClass} absolute scale-0 rotate-90 opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100`}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
