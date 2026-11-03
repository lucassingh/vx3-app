import { CalendarClock, HandCoins, Landmark, ShoppingBag } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { CajaDelDia, CompromisoCaja, Kpi } from "@/lib/api/types";
import { formatCurrency, formatDate, formatPercent, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CuentasCaja, type CuentaView } from "./cuentas-caja";

const TIPO_COMPROMISO: Record<CompromisoCaja["tipo"], string> = {
  fijo: "Fijo",
  debito: "Débito automático",
  escalonado: "En cuotas",
};

const sumar = (items: { monto: number }[]) => items.reduce((sum, item) => sum + item.monto, 0);

function kpisDe(data: CajaDelDia): Kpi[] {
  const viejas = data.cuentas.filter((cuenta) => esViejo(cuenta.actualizadoAt));
  return [
    {
      id: "disponible",
      label: "Disponible hoy",
      value: data.disponible,
      format: "currency",
      hint: viejas.length
        ? `${viejas.map((cuenta) => cuenta.nombre).join(", ")} con saldo de más de un día`
        : `${data.cuentas.length} cuentas, con el efectivo del local`,
    },
    {
      id: "vence-hoy",
      label: "Vence hoy",
      value: sumar(data.compromisosHoy),
      format: "currency",
      hint: `${data.compromisosHoy.length} pagos del registro de gastos fijos`,
    },
    {
      id: "esperado",
      label: "Se espera cobrar",
      value: data.ingresosEsperados,
      format: "currency",
      hint: "Rendición, transferencias y venta del local",
    },
    {
      id: "mercaderia",
      label: "Para mercadería hoy",
      value: Math.max(0, data.capacidadCompra),
      format: "currency",
      hint:
        data.capacidadCompra > 0
          ? `Después de guardar ${formatCurrency(data.reserva)} para los próximos 10 días`
          : "Hoy no conviene comprar: no alcanza para los vencimientos",
    },
  ];
}

function esViejo(iso: string) {
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000;
}

/** Caja del día: cuánto se puede gastar hoy en mercadería (RF-M7-10, Manual v4 P-01 y P-11). */
export async function CajaView() {
  const data = await api.cobros.caja();
  const cuentas: CuentaView[] = data.cuentas.map((cuenta) => ({
    id: cuenta.id,
    nombre: cuenta.nombre,
    saldo: cuenta.saldo,
    saldoLabel: formatCurrency(cuenta.saldo),
    actualizado: formatRelativeTime(cuenta.actualizadoAt),
    origen: cuenta.origen,
    viejo: esViejo(cuenta.actualizadoAt),
  }));

  return (
    <>
      <KpiGrid
        items={kpisDe(data)}
        label="Caja del día"
        icons={{ disponible: Landmark, "vence-hoy": CalendarClock, esperado: HandCoins, mercaderia: ShoppingBag }}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader className="pb-4">
            <div>
              <CardTitle>Cuentas</CardTitle>
              <CardDescription>
                El saldo de cada banco sale del último extracto importado. Si alguno está viejo o el efectivo cambió, se
                corrige acá y la cuenta se rehace sola.
              </CardDescription>
            </div>
          </CardHeader>
          <CuentasCaja items={cuentas} />
        </Card>
        <CalculoCard data={data} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProveedoresCard data={data} />
        <VencimientosCard data={data} />
      </div>
    </>
  );
}

function Fila({ label, value, detalle, strong }: { label: string; value: string; detalle?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={cn("text-sm", strong ? "font-semibold" : "text-muted-foreground")}>
        {label}
        {detalle && <span className="block text-xs font-normal text-muted-foreground">{detalle}</span>}
      </dt>
      <dd className={cn("shrink-0 tabular-nums", strong ? "text-lg font-semibold" : "text-sm font-medium")}>{value}</dd>
    </div>
  );
}

function CalculoCard({ data }: { data: CajaDelDia }) {
  const proximos = sumar(data.proximos);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Cómo sale el número</CardTitle>
          <CardDescription>
            Lo disponible, menos lo que vence hoy, menos lo que hay que guardar para los próximos 10 días.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-4">
        <dl className="divide-y divide-border">
          <Fila label="Disponible en cuentas" value={formatCurrency(data.disponible)} />
          <Fila
            label="Vence hoy"
            detalle={data.compromisosHoy.map((item) => item.concepto).join(" · ")}
            value={`− ${formatCurrency(sumar(data.compromisosHoy))}`}
          />
          <Fila
            label="Guardar para los próximos 10 días"
            detalle={`Vencen ${formatCurrency(proximos)} y se espera cobrar ${formatCurrency(data.ingresosEsperados)}`}
            value={`− ${formatCurrency(data.reserva)}`}
          />
          <Fila label="Para mercadería hoy" value={formatCurrency(Math.max(0, data.capacidadCompra))} strong />
        </dl>
        <div className="mt-4 space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Lo que se espera cobrar</p>
          {data.ingresos.map((ingreso) => (
            <p key={ingreso.id}>
              {ingreso.concepto}: {formatPercent(ingreso.probabilidad, { maximumFractionDigits: 0 })} de{" "}
              {formatCurrency(ingreso.monto)} · {ingreso.detalle}
            </p>
          ))}
        </div>
        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          Es una sugerencia: la decisión de caja es del dueño (P-11 R-2).
        </p>
      </CardContent>
    </Card>
  );
}

function ProveedoresCard({ data }: { data: CajaDelDia }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Saldo con proveedores</CardTitle>
          <CardDescription>
            Al ir a comprar se cubre, como mínimo, el saldo pendiente. Si no alcanza para el preferido, conviene el de
            menor saldo abierto donde todavía se puede pedir (P-01 R-1 y R-5).
          </CardDescription>
        </div>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Si vas hoy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.proveedores.map((item) => {
            const resto = data.capacidadCompra - item.saldo;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium">{item.proveedor}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.condiciones} · última compra hace {item.ultimaCompraDias} días
                  </p>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.saldo)}</TableCell>
                <TableCell>
                  {resto >= 0 ? (
                    <Badge variant="success">Quedan {formatCurrency(resto)} para mercadería</Badge>
                  ) : (
                    <Badge variant="danger">No alcanza para el saldo</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function VencimientosCard({ data }: { data: CajaDelDia }) {
  const filas = [...data.compromisosHoy, ...data.proximos];
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Vencimientos</CardTitle>
          <CardDescription>
            Hoy y los próximos 10 días, del registro de gastos fijos. Del 5 al 10 de cada mes se juntan DUX y el
            préstamo (P-11 E-3).
          </CardDescription>
        </div>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vence</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap">
                {item.vence === data.fecha ? (
                  <Badge variant="warning">Hoy</Badge>
                ) : (
                  formatDate(item.vence, { weekday: "short", day: "numeric", month: "numeric" })
                )}
              </TableCell>
              <TableCell>
                <p className="font-medium">{item.concepto}</p>
                <p className="text-xs text-muted-foreground">{TIPO_COMPROMISO[item.tipo]}</p>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.monto)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function CajaSkeleton() {
  return (
    <>
      <KpiGridSkeleton count={4} />
      <LoadingLabel>Cargando la caja del día…</LoadingLabel>
      <div className="grid gap-6 xl:grid-cols-3">
        <CardSkeleton className="xl:col-span-2">
          <TableSkeleton columns={["Cuenta", "Origen", "Saldo", ""]} rows={5} />
        </CardSkeleton>
        <CardSkeleton>
          <SkeletonText lines={6} />
        </CardSkeleton>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CardSkeleton>
          <TableSkeleton columns={["Proveedor", "Saldo", "Si vas hoy"]} rows={4} />
        </CardSkeleton>
        <CardSkeleton>
          <TableSkeleton columns={["Vence", "Concepto", "Monto"]} rows={6} />
        </CardSkeleton>
      </div>
    </>
  );
}
