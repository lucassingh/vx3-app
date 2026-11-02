import { CircleAlert, CircleCheck, Clock, HandCoins, LifeBuoy, PackageMinus, TriangleAlert, Video } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { SidePanel } from "@/components/pedidos/side-panel";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { OrigenReclamo, PostventaResumen, ReclamoPostventa, TipoReclamo } from "@/lib/api/types";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ResolverReclamo } from "./resolver-reclamo";

const TIPO: Record<TipoReclamo, string> = {
  1: "Falta mercadería",
  2: "Mal estado",
  3: "Producto equivocado",
  4: "No era lo esperado",
  5: "Demora de mensajería",
  6: "Mal enviado por Correo",
};

const ESTADO: Record<ReclamoPostventa["estado"], { label: string; variant: "warning" | "primary" | "success" }> = {
  abierto: { label: "Abierto", variant: "primary" },
  esperando_evidencia: { label: "Esperando evidencia", variant: "warning" },
  resuelto: { label: "Resuelto", variant: "success" },
};

function slaDe(reclamo: ReclamoPostventa): { label: string; variant: "success" | "warning" | "danger" | "neutral" } {
  if (reclamo.estado === "resuelto") return { label: "Dentro del plazo", variant: "neutral" };
  if (reclamo.horasRestantes < 0) return { label: `Venció hace ${-reclamo.horasRestantes} h`, variant: "danger" };
  if (reclamo.horasRestantes <= 6) return { label: `Vence en ${reclamo.horasRestantes} h`, variant: "warning" };
  return { label: `Vence en ${reclamo.horasRestantes} h`, variant: "success" };
}

const COLUMNS = ["Reclamo", "Clienta y pedido", "Tipo", "Evidencia", "Resolución sugerida", "Origen", "Plazo"];

export async function PostventaView() {
  const data = await api.postventa.resumen();
  const origenLabel = Object.fromEntries(data.causas.origenes.map((item) => [item.id, item.label])) as Record<
    OrigenReclamo,
    string
  >;

  return (
    <>
      <KpiGrid
        items={data.kpis}
        label="Indicadores de post-venta"
        icons={{ abiertos: LifeBuoy, vencen: Clock, reintegrado: HandCoins, tipo1: PackageMinus }}
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div>
            <CardTitle>Reclamos</CardTitle>
            <CardDescription>
              Cada uno vinculado a su pedido y a su clienta, con la evidencia, la resolución y la nota de crédito en el
              mismo registro. Reemplaza la planilla de reclamos.
            </CardDescription>
          </div>
        </CardHeader>
        <Table className="min-w-6xl">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.reclamos.map((reclamo) => (
              <ReclamoRow key={reclamo.id} reclamo={reclamo} data={data} origenLabel={origenLabel} />
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <CausasCard data={data} />
        <TendenciaCard data={data} />
      </div>
    </>
  );
}

function EvidenciaCell({ reclamo }: { reclamo: ReclamoPostventa }) {
  const { evidencia } = reclamo;
  if (evidencia.falta.length > 0) {
    return (
      <span className="flex items-start gap-1.5 text-[13px] text-warning">
        <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Falta: {evidencia.falta.join(", ").toLowerCase()}
      </span>
    );
  }
  if (!evidencia.requiereVideo && evidencia.recibida.length === 0) {
    return <span className="text-[13px] text-muted-foreground">No hace falta</span>;
  }
  return (
    <span className="flex items-start gap-1.5 text-[13px]">
      <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
      {evidencia.recibida.join(" y ")}
      {!evidencia.requiereVideo && reclamo.tipo <= 3 && <span className="sr-only"> (sin video por excepción)</span>}
    </span>
  );
}

function ReclamoRow({
  reclamo,
  data,
  origenLabel,
}: {
  reclamo: ReclamoPostventa;
  data: PostventaResumen;
  origenLabel: Record<OrigenReclamo, string>;
}) {
  const sla = slaDe(reclamo);
  const estado = ESTADO[reclamo.estado];
  return (
    <TableRow>
      <TableCell>
        <p className="font-mono text-[13px] font-medium">{reclamo.id}</p>
        <Badge variant={estado.variant} dot className="mt-1">
          {estado.label}
        </Badge>
      </TableCell>
      <TableCell>
        <p className="max-w-40 truncate font-medium">{reclamo.clienta.nombre}</p>
        <p className="font-mono text-xs text-muted-foreground">{reclamo.pedidoId}</p>
      </TableCell>
      <TableCell>
        <p className="whitespace-nowrap">
          <span className="text-muted-foreground">Tipo {reclamo.tipo} ·</span> {TIPO[reclamo.tipo]}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{reclamo.sku}</p>
      </TableCell>
      <TableCell className="max-w-48">
        <EvidenciaCell reclamo={reclamo} />
      </TableCell>
      <TableCell className="max-w-64">
        <p className="font-medium tabular-nums">
          {reclamo.resolucion.monto > 0 ? `Reintegro ${formatCurrency(reclamo.resolucion.monto)}` : "Sin reintegro"}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{reclamo.resolucion.sugerida}</p>
      </TableCell>
      <TableCell>
        {reclamo.origen ? (
          <Badge variant="outline">{origenLabel[reclamo.origen]}</Badge>
        ) : (
          <span className="text-[13px] text-warning">
            Falta · sugerido {origenLabel[reclamo.origenSugerido].toLowerCase()}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={sla.variant} dot>
          {sla.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <SidePanel
          trigger="Ver"
          triggerLabel={`Ver el reclamo ${reclamo.id}`}
          title={`Reclamo ${reclamo.id} · ${TIPO[reclamo.tipo]}`}
          description={`${reclamo.clienta.nombre} · pedido ${reclamo.pedidoId} · ${reclamo.responsable}`}
        >
          <ReclamoDetalle reclamo={reclamo} data={data} origenLabel={origenLabel} />
        </SidePanel>
      </TableCell>
    </TableRow>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ReclamoDetalle({
  reclamo,
  data,
  origenLabel,
}: {
  reclamo: ReclamoPostventa;
  data: PostventaResumen;
  origenLabel: Record<OrigenReclamo, string>;
}) {
  const { evidencia } = reclamo;
  return (
    <>
      <figure className="space-y-1.5">
        <figcaption className="text-xs text-muted-foreground first-letter:uppercase">
          {formatRelativeTime(reclamo.creadoAt)} · por el WhatsApp del local
        </figcaption>
        <blockquote className="rounded-xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed">
          {reclamo.relato}
        </blockquote>
        <p className="text-xs text-muted-foreground">{reclamo.producto}</p>
      </figure>

      <Section title="Evidencia">
        <div className="rounded-lg border border-border p-3 text-[13px]">
          <p className="flex items-start gap-2">
            <Video aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {evidencia.requiereVideo ? (
              <span>Hace falta el video de apertura del paquete (RN-51).</span>
            ) : (
              <span>
                No hace falta el video de apertura
                {evidencia.excepcion ? `: ${evidencia.excepcion.charAt(0).toLowerCase()}${evidencia.excepcion.slice(1)}.` : "."}
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Compra del pedido {formatCurrency(reclamo.compraPedido)} · últimos 30 días {formatCurrency(reclamo.compra30d)}
            . Excepción si supera $ 100.000 en el pedido o $ 150.000 en 30 días (RN-52).
          </p>
        </div>
        <ul className="space-y-1.5 text-[13px]">
          {evidencia.recibida.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CircleCheck aria-hidden className="size-4 text-success" />
              {item} recibido
            </li>
          ))}
          {evidencia.falta.map((item) => (
            <li key={item} className="flex items-center gap-2 text-warning">
              <CircleAlert aria-hidden className="size-4" />
              Falta: {item.toLowerCase()}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Resolución sugerida">
        <p className="text-sm">{reclamo.resolucion.sugerida}</p>
        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{reclamo.resolucion.calculo}</span>
          <span className="shrink-0 text-base font-semibold tabular-nums">
            {reclamo.resolucion.monto > 0 ? formatCurrency(reclamo.resolucion.monto) : "—"}
          </span>
        </div>
      </Section>

      {reclamo.notaCredito.necesaria && (
        <Section title="Nota de crédito asistida">
          <p className="text-[13px] text-muted-foreground">
            La API de DUX no permite crearlas: la app deja el detalle exacto para cargarlo en segundos.
          </p>
          <div className="relative rounded-lg border border-border bg-muted/40 p-3 pr-10">
            <p className="whitespace-pre-line font-mono text-xs leading-relaxed">{reclamo.notaCredito.detalle}</p>
            <CopyButton
              value={reclamo.notaCredito.detalle}
              label="Copiar el detalle de la nota de crédito"
              successMessage="Detalle copiado"
              className="absolute right-2 top-2"
            />
          </div>
          <Badge variant={reclamo.notaCredito.cargada ? "success" : "warning"} dot>
            {reclamo.notaCredito.cargada ? "Cargada en DUX y vinculada" : "Falta cargarla en DUX"}
          </Badge>
        </Section>
      )}

      <Section title="Cierre">
        {reclamo.estado === "resuelto" ? (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck aria-hidden className="size-4 text-success" />
            Resuelto por {reclamo.responsable} · origen {reclamo.origen ? origenLabel[reclamo.origen].toLowerCase() : "sin determinar"}
          </p>
        ) : (
          <ResolverReclamo
            id={reclamo.id}
            origenInicial={reclamo.origen ?? reclamo.origenSugerido}
            origenes={data.causas.origenes}
            ncNecesaria={reclamo.notaCredito.necesaria}
          />
        )}
      </Section>
    </>
  );
}

function CausasCard({ data }: { data: PostventaResumen }) {
  const { origenes, filas } = data.causas;
  const max = Math.max(1, ...filas.flatMap((fila) => Object.values(fila.porOrigen)));
  return (
    <Card className="overflow-hidden xl:col-span-2">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Causas · últimas 4 semanas</CardTitle>
          <CardDescription>Tipo de reclamo por origen probable: dónde conviene poner el control</CardDescription>
        </div>
      </CardHeader>
      <Table className="min-w-3xl">
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            {origenes.map((origen) => (
              <TableHead key={origen.id} className="text-center">
                {origen.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={fila.tipo}>
              <TableCell className="whitespace-nowrap">
                <span className="text-muted-foreground">{fila.tipo} ·</span> {fila.label}
              </TableCell>
              {origenes.map((origen) => {
                const cantidad = fila.porOrigen[origen.id] ?? 0;
                return (
                  <TableCell key={origen.id} className="text-center">
                    {cantidad > 0 ? (
                      <span
                        className="inline-grid size-8 place-items-center rounded-md text-[13px] font-semibold tabular-nums text-foreground"
                        style={{ backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.round((cantidad / max) * 45) + 8}%, transparent)` }}
                      >
                        {cantidad}
                      </span>
                    ) : (
                      <>
                        <span aria-hidden className="text-muted-foreground">·</span>
                        <span className="sr-only">Ninguno</span>
                      </>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function TendenciaCard({ data }: { data: PostventaResumen }) {
  const max = Math.max(1, ...data.tendenciaTipo1.map((item) => item.cantidad));
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Faltantes por semana</CardTitle>
          <CardDescription>Tipo 1, el reclamo más frecuente</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 pt-5">
        <ul className="flex h-32 items-end gap-3" aria-label="Faltantes por semana">
          {data.tendenciaTipo1.map((item) => (
            <li key={item.semana} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[13px] font-semibold tabular-nums">{item.cantidad}</span>
              <span
                aria-hidden
                className="w-full max-w-10 origin-bottom animate-bar-grow rounded-t-[4px] bg-warning/80"
                style={{ height: `${(item.cantidad / max) * 75}%` }}
              />
              <span className="text-center text-[11px] leading-tight text-muted-foreground">{item.semana}</span>
            </li>
          ))}
        </ul>
        {data.escalar.activo && (
          <p
            className={cn(
              "mt-auto flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-[13px]",
            )}
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            {data.escalar.mensaje}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PostventaSkeleton() {
  return (
    <>
      <KpiGridSkeleton count={4} />
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Reclamos</CardTitle>
        </CardHeader>
        <LoadingLabel>Cargando reclamos…</LoadingLabel>
        <TableSkeleton columns={[...COLUMNS, ""]} rows={6} className="min-w-6xl" />
      </Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <CardSkeleton className="xl:col-span-2">
          <SkeletonText lines={6} />
        </CardSkeleton>
        <CardSkeleton>
          <SkeletonText lines={4} />
        </CardSkeleton>
      </div>
    </>
  );
}
