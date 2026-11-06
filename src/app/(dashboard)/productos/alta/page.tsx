import { LayoutGrid, ListRestart } from "lucide-react";
import Link from "next/link";
import { param, type SearchParams } from "@/components/clientas/shared";
import { EmptyState } from "@/components/kit/empty-state";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AltaForm } from "@/components/productos/alta-form";
import { Button } from "@/components/ui/button";
import { LoadingLabel } from "@/components/ui/skeleton";
import { AsyncWidget } from "@/components/views/async-widget";
import { DatosSimulados } from "@/components/views/datos-simulados";
import { CardSkeleton, SkeletonText } from "@/components/views/skeletons";
import { realDomains } from "@/lib/api/dispatch";
import { api } from "@/lib/api/server";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";
import { can } from "@/modules/platform/permissions";

const HREF = "/productos/alta";

export const metadata = getRouteMetadata(HREF);

async function AltaLoader({
  searchParams,
  puedeEditar,
}: {
  searchParams: Promise<SearchParams>;
  puedeEditar: boolean;
}) {
  const params = await searchParams;
  const [opciones, borradores] = await Promise.all([api.catalogo.altaOpciones(), api.catalogo.altaBorradores()]);

  if (opciones.rubros.length === 0) {
    return (
      <EmptyState
        icon={ListRestart}
        title="Todavía no se leyeron las listas de DUX"
        description="Rubros, subrubros y proveedores salen de ahí. Se leen con cada sincronización: corré una desde Integraciones."
      />
    );
  }

  return (
    <AltaForm
      // Al publicar un producto nuevo cambian los códigos usados, y el formulario arranca de cero.
      key={opciones.codigosUsados.length}
      opciones={opciones}
      borradores={borradores}
      abierto={borradores.find(({ id }) => id === param(params, "borrador")) ?? null}
      real={realDomains().includes("catalogo")}
      puedeEditar={puedeEditar}
    />
  );
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
export default async function AltaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess("/productos/alta");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Alta de producto"}
        description={route?.link.description}
        actions={
          <>
            {!realDomains().includes("catalogo") && <DatosSimulados pr="1.9" />}
            <Button variant="outline" asChild>
              <Link href="/productos/catalogo">
                <LayoutGrid />
                Ver catálogo
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="el formulario de alta" fallback={<AltaSkeleton />}>
          <AltaLoader searchParams={searchParams} puedeEditar={can(user.role, "catalogo.editar")} />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
