"use client";

import { ArrowRight, CircleCheck, LoaderCircle, Wrench } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { porcentaje } from "@/components/productos/porcentaje";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api/browser";
import type { MargenBajoPiso } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

/** Productos bajo el piso con su precio sugerido. "Corregir" publica el piso nuevo en DUX (RF-M2-06). */
export function BajoPisoTable({ items }: { items: MargenBajoPiso[] }) {
  const [filas, setFilas] = useState(items);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);

  const corregir = async (fila: MargenBajoPiso) => {
    setCorrigiendo(fila.sku);
    try {
      const resultado = await api.stock.corregirPrecio(fila.sku);
      setFilas((actual) => actual.filter((item) => item.sku !== fila.sku));
      toast.success(`${resultado.codigo} publicado en DUX a ${formatCurrency(resultado.precio)}`, {
        description: "Se actualizaron MAYORISTA EF/TR y LOCAL EF/TR, y las presentaciones que dependen del costo.",
      });
    } catch {
      toast.error(`No se pudo corregir ${fila.sku}`, {
        description: "DUX no respondió. Probá de nuevo.",
        action: { label: "Reintentar", onClick: () => corregir(fila) },
      });
    } finally {
      setCorrigiendo(null);
    }
  };

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Todo el catálogo está sobre el piso"
        description="El próximo control corre mañana a las 6:00, o apenas se cargue una compra con costos nuevos."
      />
    );
  }

  return (
    <Table className="min-w-4xl">
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Costo de la docena</TableHead>
          <TableHead className="text-right">Precio del bulto</TableHead>
          <TableHead className="text-right">Margen</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => (
          <TableRow key={fila.sku}>
            <TableCell>
              <p className="font-medium">{fila.nombre}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{fila.codigo}</span> · {fila.proveedor} · {fila.motivo}
              </p>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground line-through">{formatCurrency(fila.costoDocenaAnterior)}</span>
                <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                <span className="font-medium">{formatCurrency(fila.costoDocenaNuevo)}</span>
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span>{formatCurrency(fila.precioActual)}</span>
                <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                <span className="font-semibold">{formatCurrency(fila.precioPiso)}</span>
              </span>
              <span className="block text-xs text-muted-foreground">actual → piso nuevo</span>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="danger" dot>
                {porcentaje(fila.margenActual)}
              </Badge>
              <span className="block pt-1 text-xs text-muted-foreground tabular-nums">
                piso {porcentaje(fila.margenObjetivo)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" onClick={() => corregir(fila)} disabled={corrigiendo === fila.sku}>
                {corrigiendo === fila.sku ? <LoaderCircle aria-hidden className="animate-spin" /> : <Wrench />}
                Corregir precio
                <span className="sr-only"> de {fila.sku}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
