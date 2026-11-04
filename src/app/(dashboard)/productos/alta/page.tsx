import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AltaForm } from "@/components/productos/alta-form";
import { Button } from "@/components/ui/button";
import { LoadingLabel } from "@/components/ui/skeleton";
import { AsyncWidget } from "@/components/views/async-widget";
import { CardSkeleton, SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/productos/alta";

export const metadata = getRouteMetadata(HREF);

async function AltaLoader() {
  const opciones = await api.catalogo.altaOpciones();
  // Al publicar un producto nuevo cambia la lista de SKUs y el formulario arranca de cero.
  return <AltaForm key={opciones.skus.length} opciones={opciones} />;
}

function AltaSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <LoadingLabel>Cargando el formulario…</LoadingLabel>
      <div className="space-y-6">
        <CardSkeleton>
          <SkeletonText lines={4} />
        </CardSkeleton>
        <CardSkeleton>
          <SkeletonText lines={6} />
        </CardSkeleton>
      </div>
      <CardSkeleton>
        <SkeletonText lines={5} />
      </CardSkeleton>
    </div>
  );
}

/** M1 · Alta de producto en un solo formulario. Reemplaza el Sheet, los 3 .xls y el alta del Hub. */
export default async function AltaPage() {
  await requirePageAccess("/productos/alta");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Alta de producto"}
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
        <AsyncWidget title="el formulario de alta" fallback={<AltaSkeleton />}>
          <AltaLoader />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
