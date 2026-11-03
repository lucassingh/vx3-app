"use client";

import { Bell, CheckCheck } from "lucide-react";
import { catchError } from "next/error";
import Link from "next/link";
import { startTransition, useOptimistic, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api/browser";
import type { Notification } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const markRead = (items: Notification[]) => items.map((item) => ({ ...item, read: true }));

export function NotificationsMenu({ initialItems }: { initialItems: Notification[] }) {
  const [items, setItems] = useState(initialItems);
  const [optimisticItems, markAllOptimistic] = useOptimistic(items, markRead);
  const unreadCount = optimisticItems.filter((item) => !item.read).length;

  const markAllAsRead = () => {
    startTransition(async () => {
      // Se marcan al instante; si la API falla, useOptimistic revierte solo.
      markAllOptimistic(undefined);
      try {
        await api.notifications.markAllRead();
        startTransition(() => setItems(markRead));
        toast.success("Notificaciones marcadas como leídas");
      } catch {
        toast.error("No se pudieron actualizar las notificaciones", {
          description: "Revisá la conexión e intentá de nuevo.",
          action: { label: "Reintentar", onClick: markAllAsRead },
        });
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
        >
          <Bell />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-surface"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between py-2 text-sm text-foreground">
          Notificaciones
          {unreadCount > 0 && <span className="text-xs font-normal text-muted-foreground">{unreadCount} sin leer</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {optimisticItems.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No tenés notificaciones.</p>
        )}
        {optimisticItems.map((item) => {
          const content = (
            <>
              <span
                aria-hidden
                className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {item.title}
                  {!item.read && <span className="sr-only"> (sin leer)</span>}
                </span>
                <span className="text-[13px] text-muted-foreground">{item.description}</span>
                <time dateTime={item.createdAt} className="text-xs text-muted-foreground first-letter:uppercase">
                  {formatRelativeTime(item.createdAt)}
                </time>
              </span>
            </>
          );
          return (
            <DropdownMenuItem key={item.id} asChild={Boolean(item.href)} className="h-auto items-start gap-3 py-2.5">
              {item.href ? <Link href={item.href}>{content}</Link> : content}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={unreadCount === 0}
          onSelect={(event) => {
            event.preventDefault();
            markAllAsRead();
          }}
        >
          <CheckCheck />
          Marcar todo como leído
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Ocupa el lugar de la campana mientras carga o si la API falla. */
export function NotificationsFallback({ failed = false }: { failed?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled
      aria-label={failed ? "Notificaciones no disponibles" : "Cargando notificaciones"}
    >
      <Bell />
    </Button>
  );
}

/** Si la API de notificaciones falla, la navbar sigue funcionando. */
export const NotificationsBoundary = catchError(() => <NotificationsFallback failed />);
