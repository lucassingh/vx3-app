import { ArrowRight, Printer } from "lucide-react";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { FacturaEmitida, PedidoFacturable } from "@/lib/api/types";
import { CANAL } from "@/lib/domain";
import { formatCurrency, formatRelativeTime, formatTime } from "@/lib/format";
import { CheckList } from "./check-list";
import { FacturarLote, RefreshButton } from "./facturar-lote";

/* ---- Antes y ahora -------------------------------------------------------- */

export function ContrasteCard() {
  return (
    <Card>
      <CardContent className="grid gap-6 pt-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-[13px] text-muted-foreground">Antes, en DUX</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">13 pasos por pedido</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Unos 10 campos elegidos a mano, el envío copiado del chat, 10 a 12 veces por día.
          </p>
        </div>
        <ArrowRight aria-hidden className="hidden size-5 text-muted-foreground sm:block" />
        <div>
          <p className="text-[13px] text-muted-foreground">Con la app</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">Revisar y confirmar</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Los chequeos corren solos, los campos vienen prellenados y DUX emite el comprobante por API.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- Pedidos para facturar ------------------------------------------------ */

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium">{children}</dd>
    </div>
  );
}

function FacturableContent({ item }: { item: PedidoFacturable }) {
  const { pedido, campos } = item;
  const fallas = item.chequeos.filter((chequeo) => chequeo.estado === "falla");
  const CanalIcon = CANAL[pedido.canal].icon;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span className="font-mono">{pedido.id}</span>
            <span className="font-normal text-muted-foreground">·</span>
            <span className="truncate">{pedido.clienta.nombre}</span>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
            <CanalIcon aria-hidden className="size-3.5" />
            {CANAL[pedido.canal].label} · {pedido.bultos} bultos · llegó{" "}
            <time dateTime={pedido.creadoAt}>{formatRelativeTime(pedido.creadoAt)}</time>
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(pedido.total)}</p>
          {item.listo ? (
            <Badge variant="success" dot>
              Listo para facturar
            </Badge>
          ) : (
            <Badge variant="danger" dot>
              {fallas.length === 1 ? "1 chequeo en rojo" : `${fallas.length} chequeos en rojo`}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Chequeos</p>
          <CheckList items={item.chequeos} />
        </div>
        <div>
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Campos prellenados
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/60 p-3.5">
            <Campo label="Tipo de comprobante">{campos.tipoComprobante}</Campo>
            <Campo label="Punto de venta">{campos.puntoVenta}</Campo>
            <Campo label="Lista">{campos.lista}</Campo>
            <Campo label="Etiqueta de venta">{campos.etiqueta}</Campo>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Ítems de envío</dt>
              <dd className="mt-1 space-y-1">
                {campos.items.length === 0 && <p className="text-[13px] font-medium">Sin ítems: retira en el local</p>}
                {campos.items.map((linea) => (
                  <p key={linea.codigo} className="flex justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">
                      <span className="font-mono font-medium">{linea.codigo}</span>{" "}
                      <span className="text-muted-foreground">{linea.descripcion}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(linea.monto)}</span>
                  </p>
                ))}
              </dd>
            </div>
            <div className="col-span-2">
              <Campo label="Cobranza">{campos.cobranza}</Campo>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export async function FacturablesList() {
  const items = await api.pedidos.facturables();
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title="No hay pedidos para facturar" description="Cuando un pedido se confirma, aparece acá con sus chequeos." />
      </Card>
    );
  }
  return (
    <FacturarLote
      items={items.map((item) => ({
        id: item.pedido.id,
        listo: item.listo,
        bloqueo: item.chequeos.find((chequeo) => chequeo.estado === "falla")?.detalle,
        content: <FacturableContent item={item} />,
      }))}
    />
  );
}

export function FacturablesListSkeleton() {
  return (
    <div className="space-y-3">
      <LoadingLabel>Cargando pedidos para facturar…</LoadingLabel>
      {Array.from({ length: 3 }, (_, index) => (
        <CardSkeleton key={index}>
          <SkeletonText lines={5} />
        </CardSkeleton>
      ))}
    </div>
  );
}

/* ---- Comprobantes emitidos ------------------------------------------------ */

const ARCA: Record<FacturaEmitida["arca"], { label: string; variant: "warning" | "accent" | "success" | "neutral" }> = {
  pendiente: { label: "Validando en ARCA", variant: "warning" },
  validado: { label: "Validada, esperando CAE", variant: "accent" },
  cae: { label: "Con CAE", variant: "success" },
  no_aplica: { label: "No va a ARCA", variant: "neutral" },
};

const FACTURA_COLUMNS = ["Comprobante", "Pedido", "Total", "Emitido", "ARCA", "Remito de armado"];

function FacturasFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center pb-4">
        <div>
          <CardTitle>Emitidos hoy</CardTitle>
          <CardDescription>
            La validación ante ARCA es asíncrona: pendiente, validada y con CAE. Si hay un error, la app avisa.
          </CardDescription>
        </div>
        <RefreshButton />
      </CardHeader>
      {children}
    </Card>
  );
}

export async function FacturasCard() {
  const facturas = await api.pedidos.facturas();

  return (
    <FacturasFrame>
      <Table className="min-w-3xl">
        <TableHeader>
          <TableRow>
            {FACTURA_COLUMNS.map((column) => (
              <TableHead key={column} className={column === "Total" ? "text-right" : undefined}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {facturas.map((factura) => (
            <TableRow key={factura.numero}>
              <TableCell className="font-mono text-[13px] font-medium">{factura.numero}</TableCell>
              <TableCell>
                <p className="font-mono text-[13px]">{factura.pedidoId}</p>
                <p className="text-xs text-muted-foreground">{factura.clienta}</p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(factura.total)}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                <time dateTime={factura.emitidaAt}>{formatTime(factura.emitidaAt)}</time>
              </TableCell>
              <TableCell>
                <Badge variant={ARCA[factura.arca].variant} dot>
                  {ARCA[factura.arca].label}
                </Badge>
                {factura.cae && <p className="mt-1 font-mono text-[11px] text-muted-foreground">CAE {factura.cae}</p>}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <Printer aria-hidden className="size-3.5 text-muted-foreground" />
                  {factura.remito === "en_cola" ? "En la cola de impresión" : "Impreso"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </FacturasFrame>
  );
}

export function FacturasCardSkeleton() {
  return (
    <FacturasFrame>
      <LoadingLabel>Cargando comprobantes…</LoadingLabel>
      <TableSkeleton columns={FACTURA_COLUMNS} rows={5} className="min-w-3xl" />
    </FacturasFrame>
  );
}

