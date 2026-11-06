import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Pagination, param, type SearchParams } from "@/components/clientas/shared";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { toQueryString } from "@/lib/api/http";
import { api } from "@/lib/api/server";
import type { RevisionBloque, RevisionCaso, RevisionGrupo } from "@/lib/api/types";
import { formatDate, formatNumber, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FotoDeProducto } from "./foto-de-producto";
import { ConfirmarHistoricos, DecidirFoto, DeshacerDecision, NoEsHistorico } from "./revision-acciones";

const BASE = "/productos/revision";
const POR_PAGINA = 20;

const GRUPOS: { id: RevisionGrupo; titulo: string }[] = [
  { id: "para_vender", titulo: "Para poder vender" },
  { id: "historicos", titulo: "Históricos" },
  { id: "despues", titulo: "Se puede hacer después del pase" },
];

/** Si la URL no elige, el primero que tenga algo. */
function bloqueElegido(bloques: RevisionBloque[], params: SearchParams) {
  const pedido = param(params, "bloque");
  return bloques.find(({ id }) => id === pedido) ?? bloques.find(({ casos }) => casos > 0) ?? null;
}

/* ---- Los bloques ---------------------------------------------------------- */

export async function RevisionBloques({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, resumen] = await Promise.all([searchParams, api.catalogo.revision()]);
  const elegido = bloqueElegido(resumen.bloques, params);

  if (resumen.bloques.length === 0) return null;

  return (
    <Card className="p-5">
      <p className="text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
        {formatNumber(resumen.casos)}
      </p>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        {resumen.casos === 1 ? "caso para revisar" : "casos para revisar"}
        {resumen.actualizadoEl && ` · importado ${formatRelativeTime(resumen.actualizadoEl)}`}
      </p>
      <nav aria-label="Bloques de revisión" className="mt-5 space-y-5">
        {GRUPOS.map((grupo) => (
          <section key={grupo.id} className="space-y-1">
            <h2 className="px-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {grupo.titulo}
            </h2>
            <ul>
              {resumen.bloques
                .filter((bloque) => bloque.grupo === grupo.id)
                .map((bloque) => {
                  const activo = bloque.id === elegido?.id;
                  return (
                    <li key={bloque.id}>
                      <Link
                        href={`${BASE}${toQueryString({ bloque: bloque.id })}`}
                        scroll={false}
                        aria-current={activo ? "true" : undefined}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          activo && "bg-primary/10 font-medium",
                          bloque.casos === 0 && "text-muted-foreground",
                        )}
                      >
                        <span className="min-w-0">{bloque.titulo}</span>
                        {bloque.casos > 0 ? (
                          <span className="font-medium text-foreground tabular-nums">{formatNumber(bloque.casos)}</span>
                        ) : (
                          <CheckCircle2 aria-label="Al día" className="size-4 shrink-0 text-success" />
                        )}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </nav>
    </Card>
  );
}

export function RevisionBloquesSkeleton() {
  return (
    <Card className="space-y-3 p-5">
      <LoadingLabel>Cargando los bloques…</LoadingLabel>
      <Skeleton className="h-7 w-16" />
      <SkeletonText lines={9} />
    </Card>
  );
}

/* ---- Los casos ------------------------------------------------------------ */

function CasoDeProducto({ caso, bloque, puedeEditar }: { caso: RevisionCaso; bloque: string; puedeEditar: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5">
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-2">
          {caso.sku ? (
            <Link
              href={`/productos/catalogo${toQueryString({ producto: caso.sku })}`}
              prefetch={false}
              className="rounded font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {caso.sku}
            </Link>
          ) : null}
          {caso.prioridad === "A" && <Badge variant="primary">Más vendido</Badge>}
        </p>
        {caso.nombre && <p className="mt-0.5 text-sm font-medium text-pretty">{caso.nombre}</p>}
        <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">{caso.descripcion}</p>
      </div>
      {bloque === "historicos" && caso.sku && puedeEditar ? (
        <NoEsHistorico sku={caso.sku} />
      ) : (
        <p className="shrink-0 text-xs text-muted-foreground">
          Se corrige en <span className="font-medium text-foreground">{caso.seCorrigeEn}</span>
        </p>
      )}
    </li>
  );
}

function CasoDeFoto({ caso, puedeEditar }: { caso: RevisionCaso; puedeEditar: boolean }) {
  const { foto } = caso;
  if (!foto) return null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
      <a
        href={foto.enDrive}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0 overflow-hidden rounded-lg border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <FotoDeProducto
          url={foto.miniatura}
          sku={foto.nombre}
          colores={[]}
          tamano="sm"
          className="size-20 rounded-none"
        />
        <span className="sr-only">Abrir {foto.nombre} en Drive (pestaña nueva)</span>
      </a>
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <p className="text-sm font-medium break-words">{foto.nombre}</p>
        {puedeEditar ? (
          <DecidirFoto driveId={caso.clave} nombre={foto.nombre} sugerencias={foto.sugerencias} />
        ) : (
          <p className="text-[13px] text-muted-foreground">Lo decide quien edita el catálogo.</p>
        )}
      </div>
    </li>
  );
}

export async function RevisionCasos({
  searchParams,
  puedeEditar,
}: {
  searchParams: Promise<SearchParams>;
  puedeEditar: boolean;
}) {
  const [params, resumen] = await Promise.all([searchParams, api.catalogo.revision()]);
  const bloque = bloqueElegido(resumen.bloques, params);

  if (!bloque) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title="Todavía no se importó el catálogo"
          description="Se importa en Integraciones, con el botón Reimportar de Google."
        />
      </Card>
    );
  }

  const pedida = Number(param(params, "page") ?? 1);
  const resultado = await api.catalogo.revisionCasos({
    bloque: bloque.id,
    page: Number.isInteger(pedida) && pedida > 0 ? pedida : 1,
    pageSize: POR_PAGINA,
  });
  const pagina = (page: number) => `${BASE}${toQueryString({ bloque: bloque.id, page })}`;
  const desde = (resultado.page - 1) * resultado.pageSize + 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="min-w-0 flex-1">
          <CardTitle>{bloque.titulo}</CardTitle>
          <CardDescription className="text-pretty">{bloque.ayuda}</CardDescription>
        </div>
        {bloque.id === "historicos" && bloque.casos > 0 && puedeEditar && (
          <ConfirmarHistoricos cantidad={bloque.casos} />
        )}
      </CardHeader>
      {resultado.total === 0 ? (
        <EmptyState icon={CheckCircle2} title="Al día" description="No queda nada por revisar en este bloque." />
      ) : (
        <>
          <ul className="divide-y divide-border border-t border-border">
            {resultado.data.map((caso) =>
              caso.foto ? (
                <CasoDeFoto key={caso.id} caso={caso} puedeEditar={puedeEditar} />
              ) : (
                <CasoDeProducto key={caso.id} caso={caso} bloque={bloque.id} puedeEditar={puedeEditar} />
              ),
            )}
          </ul>
          <Pagination
            label="Paginación de casos"
            from={desde}
            to={desde + resultado.data.length - 1}
            total={resultado.total}
            prevHref={resultado.page > 1 ? pagina(resultado.page - 1) : null}
            nextHref={resultado.page < resultado.totalPages ? pagina(resultado.page + 1) : null}
          />
        </>
      )}
    </Card>
  );
}

export function RevisionCasosSkeleton() {
  return (
    <Card className="overflow-hidden">
      <LoadingLabel>Cargando los casos…</LoadingLabel>
      <CardHeader className="pb-4">
        <div className="w-full space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </CardHeader>
      <div className="divide-y divide-border border-t border-border">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="px-5 py-3.5">
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---- Lo decidido ---------------------------------------------------------- */

export async function RevisionDecisiones({ puedeEditar }: { puedeEditar: boolean }) {
  const decisiones = await api.catalogo.revisionDecisiones();
  if (decisiones.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Lo que ya se decidió</CardTitle>
          <CardDescription>El Sheet no lo puede guardar: la importación lo vuelve a aplicar cada vez.</CardDescription>
        </div>
      </CardHeader>
      <ul className="divide-y divide-border border-t border-border">
        {decisiones.map(({ tipo, clave, descripcion, quien, cuando }) => (
          <li
            key={`${tipo}:${clave}`}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5"
          >
            <p className="min-w-0 text-sm text-pretty">
              {descripcion}
              <span className="block text-xs text-muted-foreground">
                {quien} · {formatDate(cuando, { day: "numeric", month: "short" })}
              </span>
            </p>
            {puedeEditar && <DeshacerDecision tipo={tipo} clave={clave} descripcion={descripcion} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
