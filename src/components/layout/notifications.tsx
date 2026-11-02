import { Suspense } from "react";
import {
  NotificationsBoundary,
  NotificationsFallback,
  NotificationsMenu,
} from "@/components/layout/notifications-menu";
import { api } from "@/lib/api/server";

async function NotificationsLoader() {
  const items = await api.notifications.list();
  return <NotificationsMenu initialItems={items} />;
}

/** Campana de la navbar: pide las notificaciones a la API sin bloquear el layout. */
export function Notifications() {
  return (
    <NotificationsBoundary>
      <Suspense fallback={<NotificationsFallback />}>
        <NotificationsLoader />
      </Suspense>
    </NotificationsBoundary>
  );
}
