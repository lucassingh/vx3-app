import { LayoutGrid, Scissors } from "lucide-react";
import Link from "next/link";
import { param, type SearchParams } from "@/components/clientas/shared";
import { EmptyState } from "@/components/kit/empty-state";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EditarProducto } from "@/components/productos/editar-producto";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { CardSkeleton, SkeletonText } from "@/components/views/skeletons";
import { baseDelStore } from "@/integrations/blob";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { datosDeLaEdicion } from "@/modules/catalog/edicion";
import { requirePageAccess } from "@/modules/platform/auth/session";
import { can } from "@/modules/platform/permissions";

const HREF = "/productos/editar";

export const metadata = getRouteMetadata(HREF);

async function Edicion({ searchParams, puedeEditar }: { searchParams: Promise<SearchParams>; puedeEditar: boolean }) {
  const sku = param(await searchParams, "producto");
  const producto = sku ? await datosDeLaEdicion(sku) : null;
  if (!producto) {
    return <EmptyState title="No está ese producto" description="Abrilo desde su ficha, en el catálogo." />;
  }
  if (!producto.cortado) {
    return (
      <EmptyState
        icon={Scissors}
        title="Antes del corte, se edita en el Sheet"
        description="Acá se pisaría con la próxima importación. El corte se hace desde la revisión del catálogo."
      />
    );
  }
  return (
    <>
      <p className="font-mono text-xs text-muted-foreground">
        {producto.sku} · {producto.nombre}
      </p>
      <EditarProducto producto={producto} mediaUrl={baseDelStore()} puedeEditar={puedeEditar} />
    </>
  );
}

/** M1 · Editar la ficha de un producto, después del corte (`solucion_doc/06` §6.2). */
export default async function EditarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess("/productos/editar");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Editar producto"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/productos/catalogo">
              <LayoutGrid />
              Ver catálogo
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget
          title="el producto"
          fallback={
            <CardSkeleton>
              <SkeletonText lines={6} />
            </CardSkeleton>
          }
        >
          <Edicion searchParams={searchParams} puedeEditar={can(user.role, "catalogo.editar")} />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
