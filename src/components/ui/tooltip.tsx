"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          // Solo el primer tooltip anima; los siguientes aparecen al instante.
          "z-50 flex origin-(--radix-tooltip-content-transform-origin) items-center gap-2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-surface data-[state=delayed-open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "rounded border border-current/20 px-1 font-mono text-[10px] leading-4 opacity-70",
        className,
      )}
      {...props}
    />
  );
}
