import { CircleAlert, CircleCheck, Clock, Mail, PackageOpen, Store, Truck, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { EnvioDelDia, GrupoDespacho, Transporte } from "@/lib/api/types";
import { TRANSPORTE, ZONA } from "@/lib/domain";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DespachoAccion } from "./despacho-accion";

const GRUPO_ICON: Record<Transporte, LucideIcon> = {
  mensajeria: Truck,
  correo: Mail,
  via_cargo: PackageOpen,
  retira: Store,
};

const ACCION_HECHA: Record<GrupoDespacho["accion"]["id"], string> = {
  zupply: "Subido a Zupply",
  micorreo: "Importado en MiCorreo",
  etiquetas: "Etiquetas impresas",
  aviso: "Clienta avisada",
};

const CORTE: Record<GrupoDespacho["corteEstado"], { label: string; variant: "success" | "warning" | "neutral" }> = {
  a_tiempo: { label: "A tiempo", variant: "success" },
  proximo: { label: "Se acerca el corte", variant: "warning" },
  cerrado: { label: "Corte cerrado", variant: "neutral" },
  sin_corte: { label: "Sin corte", variant: "neutral" },
};

const ESTADO_ENVIO: Record<
  EnvioDelDia["estado"],
  { label: string; variant: "warning" | "neutral" | "accent" | "primary" | "success" }
> = {
  esperando_pago: { label: "Esperando el pago", variant: "warning" },
  por_facturar: { label: "Falta facturar", variant: "neutral" },
  en_armado: { label: "En armado", variant: "accent" },
  subido: { label: "Listo para salir", variant: "primary" },
  despachado: { label: "Despachado", variant: "success" },
};

const COLUMNS = ["Pedido", "Destino", "Cajas y peso", "A cobrar", "Estado", "Seguimiento"];

export async function DespachoGrupos() {
  const grupos = await api.envios.despacho();
  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
        <GrupoCard key={grupo.transporte} grupo={grupo} />
      ))}
    </div>
  );
}

function GrupoCard({ grupo }: { grupo: GrupoDespacho }) {
  const Icon = GRUPO_ICON[grupo.transporte];
  const corte = CORTE[grupo.corteEstado];
  const listos = grupo.envios.filter((envio) => envio.estado === "en_armado").length;
  const titleId = `despacho-${grupo.transporte}`;

  return (
    <Card className="overflow-hidden" aria-labelledby={titleId} role="region">
      <CardHeader className="items-center pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle id={titleId} className="flex flex-wrap items-center gap-2">
              {grupo.label}
              <span className="text-[13px] font-normal text-muted-foreground tabular-nums">
                {grupo.envios.length} {grupo.envios.length === 1 ? "pedido" : "pedidos"}
              </span>
            </CardTitle>
            <CardDescription>{grupo.corteDetalle}</CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {grupo.corte && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
              <Clock aria-hidden className="size-3.5" />
              Corte {grupo.corte}
            </span>
          )}
          {grupo.corte && (
            <Badge variant={corte.variant} dot>
              {corte.label}
            </Badge>
          )}
          <DespachoAccion
            transporte={grupo.transporte}
            label={grupo.accion.label}
            hechoLabel={ACCION_HECHA[grupo.accion.id]}
            hecho={grupo.accion.hecho}
            disabled={listos === 0 && grupo.accion.id !== "aviso"}
            accion={grupo.accion.id}
          />
        </div>
      </CardHeader>

      {grupo.envios.length === 0 ? (
        <div className="border-t border-border">
          <EmptyState title={`Hoy no sale nada por ${TRANSPORTE[grupo.transporte]}`} className="py-8" />
        </div>
      ) : (
        <Table className="min-w-4xl">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column} className={column === "A cobrar" ? "text-right" : undefined}>
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupo.envios.map((envio) => (
              <EnvioRow key={envio.pedidoId} envio={envio} transporte={grupo.transporte} />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function EnvioRow({ envio, transporte }: { envio: EnvioDelDia; transporte: Transporte }) {
  const estado = ESTADO_ENVIO[envio.estado];
  const url = `https://${envio.seguimiento}`;

  return (
    <TableRow>
      <TableCell>
        <p className="font-mono text-[13px] font-medium">{envio.pedidoId}</p>
        <p className="max-w-40 truncate text-xs text-muted-foreground">{envio.clienta.nombre}</p>
      </TableCell>
      <TableCell>
        <p className="max-w-56 truncate">
          {envio.localidad}, {envio.provincia}
        </p>
        <p className={cn("flex items-start gap-1 text-xs", envio.cpValido ? "text-muted-foreground" : "text-danger")}>
          {envio.cpValido ? (
            <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0 text-success" />
          ) : (
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          )}
          <span className={cn(!envio.cpValido && "max-w-64")}>
            {envio.cpValido ? `CP ${envio.cp} · ${ZONA[envio.zona].short}` : envio.cpDetalle}
          </span>
        </p>
      </TableCell>
      <TableCell className="tabular-nums">
        {transporte === "retira" ? (
          <span className="text-muted-foreground">{envio.bultos} bultos, sin caja</span>
        ) : (
          <>
            <p>
              {envio.cajas} {envio.cajas === 1 ? "caja" : "cajas"} · {envio.bultos} bultos
            </p>
            <p className="text-xs text-muted-foreground">{formatNumber(envio.pesoKg)} kg</p>
          </>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {envio.aCobrar ? (
          <span className="font-medium">{formatCurrency(envio.aCobrar)}</span>
        ) : (
          <span className="text-muted-foreground">Pagado</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={estado.variant} dot>
          {estado.label}
        </Badge>
        {envio.etiqueta && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{envio.etiqueta}</p>}
      </TableCell>
      <TableCell>
        {transporte === "retira" ? (
          <span className="text-xs text-muted-foreground">No aplica</span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="max-w-40 truncate font-mono text-[11px] text-muted-foreground">{envio.seguimiento}</span>
            <CopyButton
              value={url}
              label={`Copiar el link de seguimiento de ${envio.pedidoId}`}
              successMessage="Link de seguimiento copiado"
            />
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function DespachoGruposSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingLabel>Cargando el despacho del día…</LoadingLabel>
      {["Mensajería · Transtech", "Vía Cargo", "Correo Argentino · MiCorreo"].map((label) => (
        <Card key={label} className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle>{label}</CardTitle>
          </CardHeader>
          <TableSkeleton columns={COLUMNS} rows={3} className="min-w-4xl" />
        </Card>
      ))}
    </div>
  );
}

/* ---- Control de desvíos (RF-M6-06) ---------------------------------------- */

const DESVIO_COLUMNS = ["Pedido", "Transportista", "Cotizado", "Cobró", "Desvío"];

function DesviosFrame({ umbral, children }: { umbral?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center pb-4">
        <div>
          <CardTitle>Control de desvíos</CardTitle>
          <CardDescription>Lo cotizado contra lo que cobró cada transportista en los últimos envíos</CardDescription>
        </div>
        {umbral}
      </CardHeader>
      {children}
    </Card>
  );
}

export async function DesviosCard() {
  const { umbral, casos } = await api.envios.desvios();
  return (
    <DesviosFrame
      umbral={<Badge variant="outline">Alerta arriba del {formatPercent(umbral, { maximumFractionDigits: 0 })}</Badge>}
    >
      <Table className="min-w-3xl">
        <TableHeader>
          <TableRow>
            {DESVIO_COLUMNS.map((column) => (
              <TableHead key={column} className={["Cotizado", "Cobró"].includes(column) ? "text-right" : undefined}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((caso) => (
            <TableRow key={caso.pedidoId}>
              <TableCell>
                <p className="font-mono text-[13px] font-medium">{caso.pedidoId}</p>
                <p className="text-xs text-muted-foreground">{caso.clienta}</p>
              </TableCell>
              <TableCell>{TRANSPORTE[caso.transporte]}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(caso.cotizado)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(caso.cobrado)}</TableCell>
              <TableCell>
                <Badge variant={caso.alerta ? "danger" : caso.desvio > 0 ? "warning" : "success"} dot>
                  {caso.desvio === 0
                    ? "Sin desvío"
                    : formatPercent(caso.desvio, { signDisplay: "exceptZero", maximumFractionDigits: 0 })}
                </Badge>
                <p className="mt-1 max-w-72 text-xs text-muted-foreground">{caso.motivo}</p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DesviosFrame>
  );
}

export function DesviosCardSkeleton() {
  return (
    <DesviosFrame>
      <LoadingLabel>Cargando desvíos…</LoadingLabel>
      <TableSkeleton columns={DESVIO_COLUMNS} rows={5} className="min-w-3xl" />
    </DesviosFrame>
  );
}
