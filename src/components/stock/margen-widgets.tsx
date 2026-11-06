import { ArrowRight, Layers, ListChecks, Percent, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Meter } from "@/components/kit/meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { CoeficientePrecio } from "@/lib/api/types";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/format";
import { BajoPisoTable } from "./bajo-piso-table";
import { EtiquetasCard } from "./etiquetas-card";

/* ---- Indicadores ------------------------------------------------------------ */

export async function MargenKpis() {
  const kpis = await api.stock.margenKpis();
  return (
    <KpiGrid
      items={kpis}
      label="Control de margen"
      icons={{ controlados: ShieldCheck, "bajo-piso": ShieldAlert, margen: Percent, capas: Layers }}
    />
  );
}

export function MargenKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Bajo el piso ------------------------------------------------------------ */

function BajoPisoFrame({ description, children }: { description: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Bajo el piso</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function BajoPisoCard() {
  const margen = await api.stock.margen();
  return (
    <BajoPisoFrame
      description={
        <>
          Último control automático <time dateTime={margen.revisadoAt}>{formatRelativeTime(margen.revisadoAt)}</time>{" "}
          sobre {margen.productosControlados} productos. Si el costo sube, el precio se actualiza siempre (RN-16)
        </>
      }
    >
      <BajoPisoTable items={margen.bajoPiso} />
    </BajoPisoFrame>
  );
}

export function BajoPisoCardSkeleton() {
  return (
    <BajoPisoFrame description="Productos cuyo precio quedó por debajo del coeficiente piso">
      <LoadingLabel>Cargando el control de margen…</LoadingLabel>
      <TableSkeleton
        columns={["Producto", "Costo de la docena", "Precio del bulto", "Margen", ""]}
        rows={3}
        className="min-w-4xl"
      />
    </BajoPisoFrame>
  );
}

/* ---- Capas de costo (RN-17) -------------------------------------------------- */

function CapasFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Capas de costo</CardTitle>
          <CardDescription>
            Si el costo bajó, se mantiene el precio mientras se vende el stock que entró al costo viejo (RN-17)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-3">{children}</CardContent>
    </Card>
  );
}

export async function CapasCard() {
  const capas = await api.stock.capas();
  return (
    <CapasFrame>
      <ul className="divide-y divide-border">
        {capas.map((capa) => (
          <li key={capa.sku} className="space-y-2.5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{capa.nombre}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-mono">{capa.sku}</span> · docena {formatCurrency(capa.costoDocenaViejo)} →{" "}
                  {formatCurrency(capa.costoDocenaNuevo)}
                </p>
              </div>
              <p className="shrink-0 text-right text-sm tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  {formatCurrency(capa.precioActual)}
                  <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                  <span className="font-semibold">{formatCurrency(capa.precioAlAgotarse)}</span>
                </span>
                <span className="block text-xs text-muted-foreground">en ~{capa.diasEstimados} días</span>
              </p>
            </div>
            <Meter
              value={capa.prendasRestantes}
              max={capa.prendasIngresadas}
              label={`Stock al costo viejo de ${capa.sku}`}
              valueText={`Quedan ${capa.prendasRestantes} de ${capa.prendasIngresadas} prendas`}
            />
            <p className="text-xs text-muted-foreground">
              Quedan {formatNumber(capa.prendasRestantes)} de {formatNumber(capa.prendasIngresadas)} prendas al costo
              viejo. La app avisa cuando se vende la última.
            </p>
          </li>
        ))}
      </ul>
    </CapasFrame>
  );
}

export function CapasCardSkeleton() {
  return (
    <CapasFrame>
      <LoadingLabel>Cargando las capas de costo…</LoadingLabel>
      <SkeletonText lines={6} />
    </CapasFrame>
  );
}

/* ---- Coeficientes vigentes --------------------------------------------------- */

function CoeficientesTabla({ titulo, filas }: { titulo: string; filas: CoeficientePrecio[] }) {
  return (
    <Table>
      <caption className="px-5 pt-1 pb-2 text-left text-[13px] font-semibold">{titulo}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>Presentación</TableHead>
          <TableHead className="text-right">Coeficiente</TableHead>
          <TableHead>Listas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => (
          <TableRow key={fila.presentacion}>
            <TableCell>
              {fila.presentacion}
              <span className="block text-xs text-muted-foreground">{fila.formula}</span>
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              × {formatNumber(fila.coeficiente, { maximumFractionDigits: 4 })}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{fila.listas}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CoeficientesFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Coeficientes vigentes</CardTitle>
          <CardDescription>Son un piso: se puede cargar más según producto y mercado (RN-18)</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/configuracion/reglas">
            <ListChecks />
            Editar en Reglas
          </Link>
        </Button>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function CoeficientesCard() {
  const coeficientes = await api.stock.coeficientes();
  return (
    <CoeficientesFrame>
      <div className="space-y-4 pb-2">
        <CoeficientesTabla titulo="Lencería" filas={coeficientes.lenceria} />
        <CoeficientesTabla titulo="Medias" filas={coeficientes.medias} />
      </div>
      <p className="border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
        Todos los precios se redondean hacia arriba a {formatCurrency(coeficientes.redondeo)}.
      </p>
    </CoeficientesFrame>
  );
}

export function CoeficientesCardSkeleton() {
  return (
    <CoeficientesFrame>
      <LoadingLabel>Cargando los coeficientes…</LoadingLabel>
      <div className="px-5 pb-5">
        <SkeletonText lines={7} />
      </div>
    </CoeficientesFrame>
  );
}

/* ---- Etiquetas ---------------------------------------------------------------- */

export async function EtiquetasLoader() {
  return <EtiquetasCard rubros={await api.catalogo.rubrosDeEjemplo()} />;
}
