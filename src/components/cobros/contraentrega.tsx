import { ChevronRight, CircleAlert, CircleCheck, HandCoins, PackageX, Truck, UserX } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type {
  CasoContraentrega,
  Kpi,
  LiquidacionTranstech,
  ReclamoTranstech,
  TipoCasoContraentrega,
} from "@/lib/api/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CasosTabs } from "./casos-tabs";
import { ReclamoDialog } from "./reclamo-dialog";

/** Tipos de caso de la rendición con Transtech (RN-46). */
export const TIPO_CASO: Record<TipoCasoContraentrega, string> = {
  entregado_sin_rendir: "Entregado sin rendir",
  efectivo_chofer: "Efectivo al chofer",
  otro_alias: "Cobro a otro alias",
  pago_sin_pedido: "Pago sin pedido claro",
  envio_duplicado: "Envío duplicado",
  rebote_fecha: "Rebote por fecha mal programada",
  devolucion_fisica: "Devolución física",
};

const fecha = (iso: string) => formatDate(iso, { day: "2-digit", month: "2-digit" });

export async function ContraentregaView() {
  const [data, reclamo] = await Promise.all([api.cobros.contraentrega(), api.cobros.reclamo()]);
  const { totales } = data;

  const kpis: Kpi[] = [
    {
      id: "total",
      label: "Plata en la calle",
      value: totales.total,
      format: "currency",
      hint: `${data.casos.length} pedidos al último corte`,
    },
    {
      id: "sin-rendir",
      label: "Entregados sin rendir",
      value: totales.entregadosSinRendir.monto,
      format: "currency",
      hint: `${totales.entregadosSinRendir.casos} pedidos`,
    },
    {
      id: "en-camino",
      label: "En camino",
      value: totales.enCamino.monto,
      format: "currency",
      hint: `${totales.enCamino.casos} pedidos`,
    },
    {
      id: "ausentes",
      label: "Ausentes",
      value: totales.ausentes.monto,
      format: "currency",
      hint: `${totales.ausentes.casos} pedidos`,
    },
  ];

  const grupos = [
    { value: "todos", label: "Todos", casos: data.casos },
    {
      value: "entregado_sin_rendir",
      label: "Entregados sin rendir",
      casos: data.casos.filter((caso) => caso.grupo === "entregado_sin_rendir"),
    },
    { value: "en_camino", label: "En camino", casos: data.casos.filter((caso) => caso.grupo === "en_camino") },
    { value: "ausente", label: "Ausentes", casos: data.casos.filter((caso) => caso.grupo === "ausente") },
  ];
  const noCoinciden = data.casos.filter((caso) => !caso.coincide).length;

  return (
    <>
      <KpiGrid
        items={kpis}
        label="Contraentrega pendiente"
        icons={{ total: HandCoins, "sin-rendir": UserX, "en-camino": Truck, ausentes: PackageX }}
      />

      <CicloCard ciclo={data.ciclo} />

      <ReclamoCard reclamo={reclamo} />

      <Card className="overflow-hidden">
        <CardHeader className="items-center pb-4">
          <div>
            <CardTitle>Casos del corte</CardTitle>
            <CardDescription>
              Estado en Zupply contra lo que arma la app cruzando DUX, el banco y la conversación.{" "}
              {noCoinciden > 0 && (
                <span className="font-medium text-danger">En {noCoinciden} casos Zupply no dice lo real.</span>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CasosTabs
          tabs={grupos.map((grupo) => ({
            value: grupo.value,
            label: grupo.label,
            count: grupo.casos.length,
            content: <CasosTable casos={grupo.casos} />,
          }))}
        />
      </Card>

      <LiquidacionesCard liquidaciones={data.liquidaciones} />
    </>
  );
}

function CicloCard({ ciclo }: { ciclo: { id: string; label: string; cantidad: number }[] }) {
  const devuelto = ciclo.find((paso) => paso.id === "devuelto");
  const pasos = ciclo.filter((paso) => paso.id !== "devuelto");
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Ciclo de la contraentrega · esta semana</CardTitle>
          <CardDescription>
            Un estado único por pedido, de facturado a rendido, alimentado por DUX, Zupply y los cuatro bancos
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <ol className="flex flex-wrap items-stretch gap-2">
          {pasos.map((paso, index) => (
            <li key={paso.id} className="flex items-center gap-2">
              <div className="min-w-28 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <p className="text-xl font-semibold tabular-nums">{paso.cantidad}</p>
                <p className="text-xs text-muted-foreground">{paso.label}</p>
              </div>
              {index < pasos.length - 1 && <ChevronRight aria-hidden className="size-4 text-muted-foreground" />}
            </li>
          ))}
          {devuelto && (
            <li className="flex items-center gap-2 sm:ml-auto">
              <div className="min-w-28 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5">
                <p className="text-xl font-semibold text-danger tabular-nums">{devuelto.cantidad}</p>
                <p className="text-xs text-muted-foreground">{devuelto.label}</p>
              </div>
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}

function ReclamoCard({ reclamo }: { reclamo: ReclamoTranstech }) {
  const titulo = `Reclamo a Transtech · ${fecha(reclamo.desde)} al ${fecha(reclamo.hasta)}`;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight">
            Reclamo semanal a Transtech
            {reclamo.enviado ? (
              <Badge variant="success" dot>
                Enviado
              </Badge>
            ) : (
              <Badge variant="warning" dot>
                Listo para enviar
              </Badge>
            )}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Ventana de lunes a sábado, del {fecha(reclamo.desde)} al {fecha(reclamo.hasta)}:{" "}
            <span className="font-medium text-foreground">
              {reclamo.casos} casos tipificados por {formatCurrency(reclamo.total)}
            </span>
            . Excluye lo que ya se reclamó. Antes lo armaba Elías a mano cruzando tres fuentes.
          </p>
        </div>
        <ReclamoDialog
          titulo={titulo}
          descripcion="Cada caso tipificado, con el mensaje listo para Federico."
          enviado={reclamo.enviado}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de caso</TableHead>
                <TableHead className="text-right">Casos</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reclamo.porTipo.map((item) => (
                <TableRow key={item.tipo}>
                  <TableCell>{item.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.casos}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(item.monto)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{reclamo.casos}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(reclamo.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Mensaje para Federico
              </p>
              <CopyButton
                value={reclamo.mensaje}
                label="Copiar el mensaje para Federico"
                successMessage="Mensaje copiado"
              />
            </div>
            <p className="rounded-xl rounded-tl-sm bg-primary/8 px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-line">
              {reclamo.mensaje}
            </p>
          </div>
        </ReclamoDialog>
      </CardContent>
    </Card>
  );
}

const CASO_COLUMNS = ["Pedido", "Clienta", "Monto", "Zupply dice", "La app encontró", "Tipo de caso", "Días"];

function CasosTable({ casos }: { casos: CasoContraentrega[] }) {
  return (
    <Table className="min-w-5xl" containerClassName="border-t border-border">
      <TableHeader className="border-t-0">
        <TableRow>
          {CASO_COLUMNS.map((column) => (
            <TableHead key={column} className={["Monto", "Días"].includes(column) ? "text-right" : undefined}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {casos.map((caso) => (
          <TableRow key={caso.id} className={cn(!caso.coincide && "bg-danger/4")}>
            <TableCell className="font-mono text-[13px] font-medium">{caso.pedidoId}</TableCell>
            <TableCell>
              <p className="max-w-40 truncate font-medium">{caso.clienta.nombre}</p>
              <p className="text-xs text-muted-foreground">{caso.localidad}</p>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(caso.monto)}</TableCell>
            <TableCell className={cn(!caso.coincide && "text-muted-foreground line-through decoration-danger/60")}>
              {caso.estadoZupply}
            </TableCell>
            <TableCell>
              <p className="flex max-w-72 items-start gap-1.5">
                {caso.coincide ? (
                  <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-danger" />
                )}
                <span>
                  {!caso.coincide && <span className="sr-only">No coincide con Zupply: </span>}
                  {caso.estadoReal}
                </span>
              </p>
            </TableCell>
            <TableCell>
              {caso.tipo ? (
                <Badge variant="warning" dot>
                  {TIPO_CASO[caso.tipo]}
                </Badge>
              ) : (
                <Badge variant="neutral">En seguimiento</Badge>
              )}
            </TableCell>
            <TableCell className={cn("text-right tabular-nums", caso.dias > 2 && "font-medium text-warning")}>
              {caso.dias}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const LIQUIDACION_COLUMNS = ["Semana", "Rendido", "Reclamado", "Recuperado", "Estado", "Nota"];

function LiquidacionesCard({ liquidaciones }: { liquidaciones: LiquidacionTranstech[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Historial de liquidaciones</CardTitle>
          <CardDescription>
            Cada semana con sus diferencias y cómo se resolvieron: el registro que hoy está en la cabeza de Elías
          </CardDescription>
        </div>
      </CardHeader>
      <Table className="min-w-4xl">
        <TableHeader>
          <TableRow>
            {LIQUIDACION_COLUMNS.map((column) => (
              <TableHead
                key={column}
                className={["Rendido", "Reclamado", "Recuperado"].includes(column) ? "text-right" : undefined}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {liquidaciones.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="tabular-nums">
                {fecha(item.desde)} al {fecha(item.hasta)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(item.rendido)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(item.reclamado)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(item.recuperado)}</TableCell>
              <TableCell>
                <Badge variant={item.estado === "cerrada" ? "success" : "warning"} dot>
                  {item.estado === "cerrada" ? "Cerrada" : "En reclamo"}
                </Badge>
              </TableCell>
              <TableCell className="max-w-80 text-[13px] text-muted-foreground">{item.nota}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function ContraentregaSkeleton() {
  return (
    <>
      <KpiGridSkeleton count={4} />
      <CardSkeleton>
        <SkeletonText lines={2} />
      </CardSkeleton>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Casos del corte</CardTitle>
        </CardHeader>
        <LoadingLabel>Cargando casos…</LoadingLabel>
        <TableSkeleton columns={CASO_COLUMNS} rows={6} className="min-w-5xl" />
      </Card>
    </>
  );
}
