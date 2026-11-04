import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { CompraHistorial } from "@/lib/api/types";
import type { BadgeTone } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RecepcionForm } from "./recepcion-form";

/* ---- Recepción en curso --------------------------------------------------- */

export async function RecepcionLoader() {
  const recepcion = await api.stock.recepcion();
  return (
    <RecepcionForm recepcion={recepcion} fechaLabel={formatDate(recepcion.fecha, { day: "numeric", month: "long" })} />
  );
}

export function RecepcionSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingLabel>Cargando la recepción…</LoadingLabel>
      <CardSkeleton>
        <SkeletonText lines={8} />
      </CardSkeleton>
      <div className="grid gap-6 xl:grid-cols-2">
        <CardSkeleton>
          <SkeletonText lines={6} />
        </CardSkeleton>
        <CardSkeleton>
          <SkeletonText lines={5} />
        </CardSkeleton>
      </div>
    </div>
  );
}

/* ---- Historial ------------------------------------------------------------- */

const ESTADO_COMPRA: Record<CompraHistorial["estado"], { label: string; tone: BadgeTone }> = {
  cargada: { label: "Cargada en DUX", tone: "success" },
  con_faltantes: { label: "Con faltantes", tone: "warning" },
  en_revision: { label: "En revisión", tone: "neutral" },
};

const COLUMNS = ["Compra", "Fecha", "Bultos", "Monto", "Faltantes", "Estado", "Firmó"];
const NUMERIC = new Set(["Bultos", "Monto", "Faltantes"]);

function HistorialFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Compras recientes</CardTitle>
          <CardDescription>Cada compra con su boleta, lo que entró y quién la revisó</CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function HistorialCard() {
  const compras = await api.stock.compras();
  return (
    <HistorialFrame>
      <Table className="min-w-3xl">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column} className={cn(NUMERIC.has(column) && "text-right")}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {compras.map((compra) => {
            const estado = ESTADO_COMPRA[compra.estado];
            return (
              <TableRow key={compra.id}>
                <TableCell>
                  <p className="font-medium">{compra.proveedor}</p>
                  <p className="text-xs text-muted-foreground">
                    {compra.id} · boleta <span className="font-mono">{compra.boleta}</span>
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(compra.fecha, { day: "numeric", month: "short" })}
                </TableCell>
                <TableCell className="text-right tabular-nums">{compra.bultos}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(compra.monto)}</TableCell>
                <TableCell
                  className={cn("text-right tabular-nums", compra.faltantes > 0 && "font-medium text-warning")}
                >
                  {compra.faltantes > 0 ? compra.faltantes : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={estado.tone} dot>
                    {estado.label}
                  </Badge>
                </TableCell>
                <TableCell>{compra.firmadaPor ?? <span className="text-muted-foreground">Sin firmar</span>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </HistorialFrame>
  );
}

export function HistorialCardSkeleton() {
  return (
    <HistorialFrame>
      <LoadingLabel>Cargando el historial…</LoadingLabel>
      <TableSkeleton columns={COLUMNS} rows={5} className="min-w-3xl" />
    </HistorialFrame>
  );
}
