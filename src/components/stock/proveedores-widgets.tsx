import { Banknote, CalendarClock, Factory, Hammer, UserRoundX } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { Kpi } from "@/lib/api/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { TIPO_PROVEEDOR } from "./labels";
import { ProveedorFicha } from "./proveedor-ficha";

const haceDias = (dias: number) => (dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`);

/** Aviso del porqué de la pantalla (DOL-25). */
export function AvisoConocimiento() {
  return (
    <Card className="flex flex-col gap-3 border-warning/30 bg-warning/5 p-5 sm:flex-row sm:items-start">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warning/12 text-warning">
        <UserRoundX aria-hidden className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Lo que hoy sabe Juan, registrado antes de enero de 2027</h2>
        <p className="max-w-3xl text-pretty text-[13px] text-muted-foreground">
          La compra a proveedores casi no está en ningún sistema. Cada ficha guarda condiciones, frecuencias, plazos, qué se le
          compra y lo que hay que saber de cada uno, para que el equipo pueda comprar sin depender de una persona.
        </p>
      </div>
    </Card>
  );
}

export async function ProveedoresKpis() {
  const proveedores = await api.stock.proveedores();
  const compras = proveedores.reduce((sum, item) => sum + item.compras30d, 0);
  const reclamables = proveedores.filter((item) => item.tipo !== "importador").length;
  const recientes = proveedores.filter((item) => item.ultimaCompraDias <= 15).length;
  const kpis: Kpi[] = [
    { id: "proveedores", label: "Proveedores", value: proveedores.length, format: "number", hint: `${recientes} con compras en los últimos 15 días` },
    { id: "compras", label: "Compras · 30 días", value: compras, format: "currency", hint: "Lo cargado en DUX desde la recepción" },
    { id: "reclamables", label: "Se les reclama la falla", value: reclamables, format: "number", hint: "Fabricantes y mayoristas (RN-36)" },
    {
      id: "plazo",
      label: "Plazo promedio de entrega",
      value: Math.round(proveedores.reduce((sum, item) => sum + item.plazoEntregaDias, 0) / proveedores.length),
      format: "number",
      hint: "Días desde el pedido hasta la recepción",
    },
  ];
  return (
    <KpiGrid
      items={kpis}
      label="Proveedores"
      icons={{ proveedores: Factory, compras: Banknote, reclamables: Hammer, plazo: CalendarClock }}
    />
  );
}

export function ProveedoresKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

const COLUMNS = ["Proveedor", "Tipo", "Frecuencia", "Condiciones", "Última compra", "Compras 30 días", ""];

function TablaFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Fichas de proveedores</CardTitle>
          <CardDescription>Ordenados por lo comprado en los últimos 30 días</CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function ProveedoresTabla() {
  const proveedores = (await api.stock.proveedores()).toSorted((a, b) => b.compras30d - a.compras30d);

  return (
    <TablaFrame>
      <Table className="min-w-4xl">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column, index) => (
              <TableHead key={`${column}-${index}`} className={column === "Compras 30 días" ? "text-right" : undefined}>
                {column || <span className="sr-only">Acciones</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {proveedores.map((proveedor) => {
            const tipo = TIPO_PROVEEDOR[proveedor.tipo];
            return (
              <TableRow key={proveedor.id}>
                <TableCell>
                  <p className="font-medium">{proveedor.nombre}</p>
                  <p className="max-w-56 truncate text-xs text-muted-foreground">{proveedor.rubros.join(" · ")}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={tipo.tone} dot>
                    {tipo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {proveedor.frecuencia}
                  <span className="block text-xs text-muted-foreground">
                    entrega en {proveedor.plazoEntregaDias} {proveedor.plazoEntregaDias === 1 ? "día" : "días"}
                  </span>
                </TableCell>
                <TableCell className="max-w-56 text-[13px] text-muted-foreground">{proveedor.condiciones}</TableCell>
                <TableCell className="text-muted-foreground">{haceDias(proveedor.ultimaCompraDias)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {proveedor.compras30d > 0 ? formatCurrencyCompact(proveedor.compras30d) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <ProveedorFicha
                    proveedor={proveedor}
                    ultimaCompra={haceDias(proveedor.ultimaCompraDias)}
                    compras30d={proveedor.compras30d > 0 ? formatCurrency(proveedor.compras30d) : "Sin compras"}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TablaFrame>
  );
}

export function ProveedoresTablaSkeleton() {
  return (
    <TablaFrame>
      <LoadingLabel>Cargando proveedores…</LoadingLabel>
      <TableSkeleton columns={COLUMNS} rows={6} className="min-w-4xl" />
    </TablaFrame>
  );
}
