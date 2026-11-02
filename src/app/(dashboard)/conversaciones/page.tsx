import { Activity, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { InboxLoader, InboxSkeleton } from "@/components/conversaciones/inbox-loader";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/conversaciones";

export const metadata = getRouteMetadata(HREF);

/** M11 · Conversaciones: todas las charlas de WhatsApp en la app, junto a la clienta y su pedido. */
export default function ConversacionesPage() {
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.section?.label}
        title={route?.link.title ?? "Conversaciones"}
        description={route?.link.description}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/bot/rendimiento">
                <Activity />
                Rendimiento del bot
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/bot/configuracion">
                <SlidersHorizontal />
                Configurar el bot
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="las conversaciones" fallback={<InboxSkeleton />}>
          <InboxLoader />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
