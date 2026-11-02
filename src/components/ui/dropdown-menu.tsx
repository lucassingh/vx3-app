"use client";

import { Check, ChevronRight } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const contentClass =
  "z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-xl border border-border bg-popover p-1 text-foreground shadow-popover data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in";

const itemClass =
  "relative flex h-8 cursor-default select-none items-center gap-2.5 rounded-md px-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(contentClass, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item className={cn(itemClass, className)} {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="text-foreground!" />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger>) {
  return (
    <MenuPrimitive.SubTrigger
      className={cn(itemClass, "data-[state=open]:bg-muted", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        sideOffset={6}
        className={cn(contentClass, "min-w-40", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}
