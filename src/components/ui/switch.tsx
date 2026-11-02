"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-border-strong transition-colors duration-200 ease-snappy disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-200 ease-snappy data-[state=checked]:translate-x-[1.125rem] dark:data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
