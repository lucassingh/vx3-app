import { ArrowLeftRight, CircleAlert, Clock, Landmark, ScanText, TriangleAlert } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Meter } from "@/components/kit/meter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { ComprobanteLeido, ConciliacionResumen, PropuestaCruce, SinCruce } from "@/lib/api/types";
import { BANCO } from "@/lib/domain";
import { formatCurrency, formatDate, formatPercent, formatRelativeTime, formatTime } from "@/lib/format";
import { ImportButton } from "./import-button";
import { Propuestas, type PropuestaView } from "./propuestas";

function toView(item: PropuestaCruce): PropuestaView {
  const { movimiento } = item;
  const horas = movimiento.horasSinCargar;
  return {
    id: item.id,
    puntaje: item.puntaje,
    banco: BANCO[movimiento.banco],
    monto: formatCurrency(movimiento.monto),
    titular: movimiento.titular,
    cuando: `${formatTime(movimiento.fecha)} · ${formatRelativeTime(movimiento.fecha)}`,
    fechaBanco: `Fecha del banco: ${formatDate(movimiento.fecha.slice(0, 10), { day: "2-digit", month: "2-digit" })}`,
    antiguedad:
      horas >= 48
        ? { label: "Viejo: más de 2 días", tone: "danger" }
        : horas >= 24
          ? { label: `Sin cargar hace ${horas} h`, tone: "warning" }
          : undefined,
    pedidoId: item.pedido.id,
    clienta: item.pedido.clienta.nombre,
    totalPedido: formatCurrency(item.pedido.total),
    razones: item.razones,
  };
}

/** Pantalla de conciliación: una sola consulta alimenta todos los bloques. */
export async function ConciliacionView() {
  const data = await api.cobros.conciliacion();
  const pendientes = data.propuestas.filter((item) => item.estado === "propuesta");

  return (
    <>
      <KpiGrid
        items={data.kpis}
        label="Indicadores de conciliación"
        icons={{ "sin-conciliar": ArrowLeftRight, automaticas: ScanText, "24h": Clock, viejos: TriangleAlert }}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader className="pb-4">
            <div>
              <CardTitle>Cruces propuestos</CardTitle>
              <CardDescription>
                Monto exacto, fecha, titular parecido y comprobante del chat. Al confirmar, el cobro se registra en DUX
                con la fecha del banco y queda imputado a su venta.
              </CardDescription>
            </div>
          </CardHeader>
          <Propuestas items={pendientes.map(toView)} />
        </Card>
        <ExtractosCard data={data} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SinCruceCard items={data.sinCruce} />
        <ComprobantesCard items={data.comprobantes} />
      </div>
    </>
  );
}

function ExtractosCard({ data }: { data: ConciliacionResumen }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Extractos de los bancos</CardTitle>
          <CardDescription>Último import de cada cuenta</CardDescription>
        </div>
        <ImportButton
          label="Importar"
          successTitle="Extracto importado"
          successDescription="los movimientos nuevos se cruzan con los pedidos pendientes."
        />
      </CardHeader>
      <CardContent className="flex-1 pt-5">
        <ul className="space-y-5">
          {data.extractos.map((extracto) => (
            <li key={extracto.banco} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Landmark aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{BANCO[extracto.banco]}</p>
                    <p className="text-xs text-muted-foreground first-letter:uppercase">
                      {formatRelativeTime(extracto.importadoAt)} · {extracto.formato}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">{extracto.conciliados}</span> de {extracto.movimientos}
                </span>
              </div>
              <Meter
                value={extracto.conciliados}
                max={extracto.movimientos}
                label={`Movimientos conciliados de ${BANCO[extracto.banco]}`}
                valueText={`${extracto.conciliados} de ${extracto.movimientos}`}
                tone="success"
              />
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          La cuenta de cobro rota entre los cuatro bancos. Si alguno ofrece API, el import pasa a ser automático.
        </p>
      </CardContent>
    </Card>
  );
}

const CASO: Record<SinCruce["caso"], string> = {
  otro_alias: "Pagó a otro alias",
  tercero: "A nombre de un tercero",
  pago_sin_pedido: "Sin pedido claro",
};

function SinCruceCard({ items }: { items: SinCruce[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sin cruce</CardTitle>
          <CardDescription>
            Lo que no aparece por ningún lado no se carga: la ausencia es el registro (RN-43)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="space-y-1.5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="warning" dot>
                  {CASO[item.caso]}
                </Badge>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.monto)}</span>
              </div>
              <p className="text-[13px]">
                <span className="font-medium">{item.titular}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {item.banco ? BANCO[item.banco] : "comprobante del chat"} · {formatRelativeTime(item.fecha)}
                </span>
              </p>
              <p className="text-[13px] text-muted-foreground">{item.detalle}</p>
              <p className="flex items-start gap-1.5 text-[13px]">
                <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {item.sugerencia}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const COMPROBANTE: Record<ComprobanteLeido["estado"], { label: string; variant: "success" | "primary" | "warning" }> = {
  conciliado: { label: "Conciliado", variant: "success" },
  propuesto: { label: "Cruce propuesto", variant: "primary" },
  sin_cruce: { label: "Sin cruce", variant: "warning" },
};

const COMPROBANTE_COLUMNS = ["Clienta", "Monto", "Banco y titular", "Operación", "Pedido", "Lectura", "Estado"];

function ComprobantesCard({ items }: { items: ComprobanteLeido[] }) {
  return (
    <Card className="overflow-hidden xl:col-span-2">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Comprobantes leídos por IA</CardTitle>
          <CardDescription>
            Cuando la clienta manda la foto o el PDF de la transferencia por WhatsApp, la app extrae monto, banco,
            titular y número de operación
          </CardDescription>
        </div>
      </CardHeader>
      <Table className="min-w-4xl">
        <TableHeader>
          <TableRow>
            {COMPROBANTE_COLUMNS.map((column) => (
              <TableHead key={column} className={column === "Monto" ? "text-right" : undefined}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <p className="font-medium">{item.clienta}</p>
                <p className="text-xs text-muted-foreground first-letter:uppercase">
                  <time dateTime={item.recibidoAt}>{formatRelativeTime(item.recibidoAt)}</time>
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(item.monto)}</TableCell>
              <TableCell>
                <p>{item.banco}</p>
                <p className="text-xs text-muted-foreground">{item.titular}</p>
              </TableCell>
              <TableCell className="font-mono text-xs">{item.operacion}</TableCell>
              <TableCell className="font-mono text-[13px]">{item.pedidoId ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatPercent(item.confianza, { maximumFractionDigits: 0 })}
              </TableCell>
              <TableCell>
                <Badge variant={COMPROBANTE[item.estado].variant} dot>
                  {COMPROBANTE[item.estado].label}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function ConciliacionSkeleton() {
  return (
    <>
      <KpiGridSkeleton count={4} />
      <div className="grid gap-6 xl:grid-cols-3">
        <CardSkeleton className="xl:col-span-2">
          <SkeletonText lines={8} />
        </CardSkeleton>
        <CardSkeleton>
          <SkeletonText lines={6} />
        </CardSkeleton>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <CardSkeleton>
          <SkeletonText lines={6} />
        </CardSkeleton>
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle>Comprobantes leídos por IA</CardTitle>
          </CardHeader>
          <LoadingLabel>Cargando comprobantes…</LoadingLabel>
          <TableSkeleton columns={COMPROBANTE_COLUMNS} rows={5} className="min-w-4xl" />
        </Card>
      </div>
    </>
  );
}
