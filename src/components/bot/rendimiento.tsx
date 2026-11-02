import { Activity, Bot, CircleCheck, Coins, FlaskConical, Timer } from "lucide-react";
import { BarList } from "@/components/kit/bar-list";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Meter } from "@/components/kit/meter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarListSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { BotRendimiento, EtapaPuestaEnMarcha } from "@/lib/api/types";
import { formatNumber, formatPercent, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RespuestasList } from "./respuestas-list";

const pct = (value: number) => formatPercent(value, { maximumFractionDigits: 0 });

/* ---- Indicadores ------------------------------------------------------------ */

export async function BotKpis() {
  const { kpis } = await api.bot.rendimiento();
  return (
    <KpiGrid
      items={kpis}
      label="Indicadores del bot"
      icons={{ atendidas: Activity, "sin-derivar": CircleCheck, "primera-respuesta": Timer, costo: Coins }}
    />
  );
}

/* ---- Puesta en marcha -------------------------------------------------------- */

const ETAPAS: { id: EtapaPuestaEnMarcha; label: string }[] = [
  { id: "sombra", label: "Sombra" },
  { id: "parcial", label: "Parcial" },
  { id: "completo", label: "Completo" },
];

function PuestaFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Puesta en marcha</CardTitle>
          <CardDescription>
            De a poco y sin cortar la venta: cada etapa se habilita cuando el acierto lo justifica
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function detalleEtapa(id: EtapaPuestaEnMarcha, puesta: BotRendimiento["puestaEnMarcha"]) {
  switch (id) {
    case "sombra":
      return `${puesta.diasEnSombra} días: el bot propuso y una persona aprobó o corrigió. ${formatNumber(puesta.correccionesEnSombra)} correcciones entraron al set de prueba.`;
    case "parcial":
      return `Responde solo en los recorridos habilitados, ${puesta.horario.toLowerCase()}. Deriva el resto.`;
    case "completo":
      return `Cuando el acierto sobre conversaciones reales supere el ${pct(puesta.umbral)}. Recién ahí se da de baja lo de Byos.`;
  }
}

export async function PuestaEnMarchaCard() {
  const { puestaEnMarcha: puesta } = await api.bot.rendimiento();
  const actual = ETAPAS.findIndex((etapa) => etapa.id === puesta.etapa);

  return (
    <PuestaFrame>
      <ol className="grid gap-3 md:grid-cols-3">
        {ETAPAS.map((etapa, index) => {
          const estado = index < actual ? "hecha" : index === actual ? "actual" : "proxima";
          return (
            <li
              key={etapa.id}
              aria-current={estado === "actual" ? "step" : undefined}
              className={cn(
                "rounded-lg border p-4",
                estado === "actual" ? "border-primary/40 bg-primary/8" : "border-border bg-muted/30",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs font-semibold",
                      estado === "hecha" && "bg-success/15 text-success",
                      estado === "actual" && "bg-primary text-primary-foreground",
                      estado === "proxima" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {estado === "hecha" ? <CircleCheck aria-hidden className="size-3.5" /> : index + 1}
                  </span>
                  {etapa.label}
                </p>
                <Badge variant={estado === "hecha" ? "success" : estado === "actual" ? "primary" : "neutral"}>
                  {estado === "hecha" ? "Hecha" : estado === "actual" ? "Hoy" : "Próxima"}
                </Badge>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{detalleEtapa(etapa.id, puesta)}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p>
            Acierto sobre <span className="tabular-nums">{formatNumber(puesta.conversacionesEvaluadas)}</span>{" "}
            conversaciones reales
          </p>
          <p className="tabular-nums">
            <span className="text-xl font-semibold">{pct(puesta.acierto)}</span>
            <span className="text-muted-foreground"> · umbral {pct(puesta.umbral)}</span>
          </p>
        </div>
        <div className="relative">
          <Meter
            value={puesta.acierto}
            label="Acierto del bot"
            valueText={`${pct(puesta.acierto)} de acierto; el umbral para pasar a completo es ${pct(puesta.umbral)}`}
            tone={puesta.acierto >= puesta.umbral ? "success" : "primary"}
            className="h-2"
          />
          <span
            aria-hidden
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground"
            style={{ left: `${puesta.umbral * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Faltan {formatNumber(Math.max(0, Math.round((puesta.umbral - puesta.acierto) * 100)))} puntos para habilitar
          el bot completo.
        </p>
      </div>
    </PuestaFrame>
  );
}

export function PuestaEnMarchaSkeleton() {
  return (
    <PuestaFrame>
      <LoadingLabel>Cargando la puesta en marcha…</LoadingLabel>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-2 w-full rounded-full" />
    </PuestaFrame>
  );
}

/* ---- Derivaciones ------------------------------------------------------------ */

function DerivacionesFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Por qué derivó</CardTitle>
          <CardDescription>Motivos de las derivaciones a una persona · 7 días</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function DerivacionesCard() {
  const { derivaciones } = await api.bot.rendimiento();
  const total = derivaciones.reduce((sum, item) => sum + item.value, 0);

  return (
    <DerivacionesFrame>
      <BarList
        items={derivaciones.map((item) => ({
          id: item.id,
          label: item.label,
          value: item.value,
          valueLabel: formatNumber(item.value),
          detail: pct(item.value / total),
        }))}
      />
      <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">
        Cada vez que una persona toma una conversación elige el motivo: así se sabe dónde mejorar el bot.
      </p>
    </DerivacionesFrame>
  );
}

export function DerivacionesSkeleton() {
  return (
    <DerivacionesFrame>
      <LoadingLabel>Cargando derivaciones…</LoadingLabel>
      <BarListSkeleton rows={6} />
    </DerivacionesFrame>
  );
}

/* ---- Recorridos -------------------------------------------------------------- */

const RECORRIDO_COLUMNS = ["Recorrido", "Conversaciones", "Acierto", "Estado"];

function RecorridosFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Acierto por recorrido</CardTitle>
          <CardDescription>
            Los casos que tiene que resolver el bot, medidos contra conversaciones reales
          </CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function RecorridosCard() {
  const { recorridos, puestaEnMarcha } = await api.bot.rendimiento();

  return (
    <RecorridosFrame>
      <Table className="min-w-2xl">
        <TableHeader>
          <TableRow>
            {RECORRIDO_COLUMNS.map((column, index) => (
              <TableHead key={column} className={cn(index === 1 && "text-right", index === 2 && "w-56")}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {recorridos.map((recorrido) => (
            <TableRow key={recorrido.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-muted text-xs font-semibold"
                  >
                    {recorrido.id}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{recorrido.nombre}</p>
                    <p className="text-xs text-muted-foreground">{recorrido.descripcion}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {recorrido.habilitado ? formatNumber(recorrido.conversaciones) : "—"}
              </TableCell>
              <TableCell>
                {recorrido.acierto === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <Meter
                      value={recorrido.acierto}
                      label={`Acierto del recorrido ${recorrido.id}`}
                      valueText={pct(recorrido.acierto)}
                      tone={recorrido.acierto >= puestaEnMarcha.umbral ? "success" : "warning"}
                      className="w-24"
                    />
                    <span className="text-sm font-medium tabular-nums">{pct(recorrido.acierto)}</span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                {recorrido.habilitado ? (
                  <Badge variant="success" dot>
                    Habilitado
                  </Badge>
                ) : (
                  <Badge variant="neutral" dot>
                    Fase posterior
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RecorridosFrame>
  );
}

export function RecorridosSkeleton() {
  return (
    <RecorridosFrame>
      <LoadingLabel>Cargando recorridos…</LoadingLabel>
      <TableSkeleton columns={RECORRIDO_COLUMNS} rows={7} className="min-w-2xl" />
    </RecorridosFrame>
  );
}

/* ---- Backlog ----------------------------------------------------------------- */

const backlogBadge = {
  cumple: { label: "Cumple", variant: "success" },
  en_prueba: { label: "En prueba", variant: "warning" },
  pendiente: { label: "Pendiente", variant: "neutral" },
} as const;

function BacklogFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Lo que se le pidió a Byos</CardTitle>
          <CardDescription>Las nueve mejoras pendientes son el criterio para aprobar el bot nuevo</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-3">{children}</CardContent>
    </Card>
  );
}

export async function BacklogCard() {
  const { backlog } = await api.bot.rendimiento();
  const cumple = backlog.filter((item) => item.estado === "cumple").length;

  return (
    <BacklogFrame>
      <p className="mb-2 text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{cumple}</span> de {backlog.length} cumplidas
      </p>
      <ul className="divide-y divide-border">
        {backlog.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 w-8 shrink-0 font-mono text-xs text-muted-foreground">{item.id}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{item.criterio}</p>
              <p className="text-xs text-muted-foreground">{item.evidencia}</p>
            </div>
            <Badge variant={backlogBadge[item.estado].variant} dot>
              {backlogBadge[item.estado].label}
            </Badge>
          </li>
        ))}
      </ul>
    </BacklogFrame>
  );
}

export function BacklogSkeleton() {
  return (
    <BacklogFrame>
      <LoadingLabel>Cargando criterios…</LoadingLabel>
      <SkeletonText lines={9} />
    </BacklogFrame>
  );
}

/* ---- Respuestas recientes ---------------------------------------------------- */

function RespuestasFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bot aria-hidden className="size-4 text-muted-foreground" />
            Respuestas recientes
          </CardTitle>
          <CardDescription>
            Qué respondió, con qué datos y por qué derivó. Una respuesta mala entra al set de evaluación.
          </CardDescription>
        </div>
        <Badge variant="outline" className="gap-1">
          <FlaskConical aria-hidden className="size-3" />
          Set de evaluación: 412 casos
        </Badge>
      </CardHeader>
      <div className="border-t border-border">{children}</div>
    </Card>
  );
}

export async function RespuestasCard() {
  const [{ generadoEn, respuestas }, { recorridos }] = await Promise.all([api.bot.respuestas(), api.bot.rendimiento()]);
  const now = new Date(generadoEn).getTime();
  const nombres = Object.fromEntries(recorridos.map((recorrido) => [recorrido.id, recorrido.nombre]));

  return (
    <RespuestasFrame>
      <RespuestasList
        initial={respuestas.map((respuesta) => ({
          ...respuesta,
          hace: formatRelativeTime(respuesta.respondidaEn, now),
          recorridoNombre: nombres[respuesta.recorrido] ?? "",
        }))}
      />
    </RespuestasFrame>
  );
}

export function RespuestasSkeleton() {
  return (
    <RespuestasFrame>
      <LoadingLabel>Cargando respuestas…</LoadingLabel>
      <div className="space-y-6 px-5 py-5">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="h-4 w-64" />
            <div className="grid gap-2 lg:grid-cols-2">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-80" />
          </div>
        ))}
      </div>
    </RespuestasFrame>
  );
}

export function BotKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}
