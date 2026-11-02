"use client";

import { ClipboardList, NotebookPen } from "lucide-react";
import Link from "next/link";
import { ColorDots, ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StockProveedor } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TIPO_PROVEEDOR } from "./labels";

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Ficha del proveedor (RF-M2-11): condiciones, notas y lo que se le compra. */
export function ProveedorFicha({
  proveedor,
  ultimaCompra,
  compras30d,
}: {
  proveedor: StockProveedor;
  ultimaCompra: string;
  compras30d: string;
}) {
  const tipo = TIPO_PROVEEDOR[proveedor.tipo];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Ver ficha<span className="sr-only"> de {proveedor.nombre}</span>
        </Button>
      </DialogTrigger>
      <DialogContent variant="side" className="max-w-lg">
        <DialogHeader>
          <Badge variant={tipo.tone} dot className="w-fit">
            {tipo.label}
          </Badge>
          <DialogTitle>{proveedor.nombre}</DialogTitle>
          <DialogDescription>{proveedor.rubros.join(" · ")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <dl className="divide-y divide-border">
            <Dato label="Frecuencia">{proveedor.frecuencia}</Dato>
            <Dato label="Condiciones">{proveedor.condiciones}</Dato>
            <Dato label="Plazo de entrega">
              {proveedor.plazoEntregaDias} {proveedor.plazoEntregaDias === 1 ? "día" : "días"}
            </Dato>
            <Dato label="Última compra">{ultimaCompra}</Dato>
            <Dato label="Compras 30 días">{compras30d}</Dato>
            <Dato label="Mercadería fallada">{tipo.reclamo} (RN-36)</Dato>
          </dl>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold">
              <NotebookPen aria-hidden className="size-4 text-muted-foreground" />
              Lo que hay que saber
            </h3>
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed">{proveedor.notas}</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold">
              Qué se le compra <span className="font-normal text-muted-foreground">· {proveedor.productos.length} productos</span>
            </h3>
            {proveedor.productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay productos de este proveedor en el catálogo.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {proveedor.productos.map((producto) => (
                  <li key={producto.sku} className="flex items-center gap-3 px-3 py-2.5">
                    <ProductThumb sku={producto.sku} colors={producto.colores} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{producto.nombre}</p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{producto.sku}</span>
                        <ColorDots colors={producto.colores} max={5} />
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums">
                      <p className="font-medium text-foreground">{formatCurrency(producto.costoDocena)}</p>
                      <p className="text-muted-foreground">{formatNumber(producto.disponibleBultos)} bultos</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" asChild>
            <Link href="/stock/compras">
              <ClipboardList />
              Registrar una compra
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
