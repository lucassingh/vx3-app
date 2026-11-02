"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/** Lista de pestañas con forma de control segmentado. */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-muted p-0.5 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150 hover:text-foreground focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-card [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("outline-none data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  );
}
