"use client";

import { LogOut, Monitor, Moon, Sun, SunMoon } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { userNavigation } from "@/config/navigation";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentUser } from "@/lib/auth";
import type { ThemePreference } from "@/lib/preferences";

const themeOptions = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] satisfies { value: ThemePreference; label: string; icon: typeof Sun }[];

export function UserMenu() {
  const { theme, setTheme } = useTheme();
  const { signOut } = useSignOut();
  const currentUser = useCurrentUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menú de usuario de ${currentUser.name}`}
          className="rounded-full transition-[scale] duration-150 ease-snappy active:scale-95"
        >
          <Avatar name={currentUser.name} src={currentUser.avatarUrl} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
          <Avatar name={currentUser.name} src={currentUser.avatarUrl} className="size-9" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{currentUser.name}</span>
            <span className="truncate text-xs text-muted-foreground">{currentUser.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {userNavigation.map((link) => {
            const Icon = link.icon;
            return (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>
                  {Icon && <Icon aria-hidden />}
                  {link.title}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoon aria-hidden />
              Tema
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <Icon aria-hidden />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
