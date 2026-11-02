"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] satisfies { value: ThemePreference; label: string; icon: typeof Sun }[];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset>
      <legend className="sr-only">Tema</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        {options.map(({ value, label, icon: Icon }) => (
          <label key={value} className="group cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => setTheme(value)}
              className="peer sr-only"
            />
            <div className="rounded-xl border border-border p-1.5 transition-[border-color,box-shadow] duration-150 group-hover:border-border-strong peer-checked:border-primary peer-checked:ring-[3px] peer-checked:ring-primary/15 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
              {value === "system" ? (
                <div className="relative h-24 overflow-hidden rounded-lg">
                  <ThemePreview mode="light" className="absolute inset-0" />
                  <ThemePreview
                    mode="dark"
                    className="absolute inset-0 [clip-path:polygon(55%_0,100%_0,100%_100%,35%_100%)]"
                  />
                </div>
              ) : (
                <ThemePreview mode={value} className="h-24" />
              )}
            </div>
            <span className="mt-2.5 flex items-center gap-2 px-1 text-sm font-medium">
              <Icon aria-hidden className="size-4 text-muted-foreground" />
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Mini maqueta del panel con los tokens reales del tema indicado. */
function ThemePreview({ mode, className }: { mode: "light" | "dark"; className?: string }) {
  return (
    <div
      aria-hidden
      data-theme={mode}
      className={cn("flex overflow-hidden rounded-lg bg-canvas", className)}
    >
      <div className="w-1/4 space-y-1.5 border-r border-border bg-surface p-2">
        <div className="mb-2.5 size-2.5 rounded-[3px] bg-primary" />
        <div className="h-1.5 w-full rounded-full bg-primary/25" />
        <div className="h-1.5 w-3/4 rounded-full bg-muted-foreground/25" />
        <div className="h-1.5 w-5/6 rounded-full bg-muted-foreground/25" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-4 border-b border-border bg-surface" />
        <div className="grid flex-1 grid-cols-2 gap-1.5 p-2">
          <div className="rounded-[4px] border border-border bg-surface" />
          <div className="rounded-[4px] border border-border bg-surface" />
          <div className="col-span-2 rounded-[4px] border border-border bg-surface" />
        </div>
      </div>
    </div>
  );
}
