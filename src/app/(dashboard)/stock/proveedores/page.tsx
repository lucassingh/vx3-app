import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  AvisoConocimiento,
  ProveedoresKpis,
  ProveedoresKpisSkeleton,
  ProveedoresTabla,
  ProveedoresTablaSkeleton,
} from "@/components/stock/proveedores-widgets";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/stock/proveedores";

export const metadata = getRouteMetadata(HREF);

/** M2 · Ficha de proveedores (RF-M2-11): el conocimiento de compras, registrado. */
export default async function ProveedoresPage() {
  await requirePageAccess("/stock/proveedores");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Proveedores"}
        description={route?.link.description}
        actions={
          <Button asChild>
            <Link href="/stock/compras">
              <ClipboardList />
              Recibir mercadería
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AvisoConocimiento />

        <AsyncWidget title="los indicadores de proveedores" fallback={<ProveedoresKpisSkeleton />}>
          <ProveedoresKpis />
        </AsyncWidget>

        <AsyncWidget title="los proveedores" fallback={<ProveedoresTablaSkeleton />}>
          <ProveedoresTabla />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
