"use client";

import { Check, CircleAlert, ImageOff, Sparkles, Warehouse, X } from "lucide-react";
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
import type { CatalogoProducto } from "@/lib/api/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CANALES_PUBLICACION, ESTADO_PRODUCTO } from "./labels";

function Atributo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children ?? <span className="text-muted-foreground">Sin cargar</span>}</dd>
    </div>
  );
}

function Seccion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Ficha completa del producto en un panel lateral. `children` es el disparador. */
export function ProductoDetalle({ producto, children }: { producto: CatalogoProducto; children: React.ReactElement }) {
  const estado = ESTADO_PRODUCTO[producto.estado];
  const [largo, ancho, alto] = producto.medidasCm;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent variant="side" className="max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {producto.sku}
            </Badge>
            <Badge variant={estado.tone} dot>
              {estado.label}
            </Badge>
          </div>
          <DialogTitle className="text-balance">{producto.nombre}</DialogTitle>
          <DialogDescription>
            {producto.rubro} · {producto.subrubro} · {producto.proveedor}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="flex gap-4">
            <ProductThumb sku={producto.sku} colors={producto.colores} size="lg" className="w-28" />
            <dl className="min-w-0 flex-1 divide-y divide-border">
              <Atributo label="Bulto">
                <span className="font-medium tabular-nums">{formatCurrency(producto.bulto.precio)}</span>{" "}
                <span className="text-muted-foreground">
                  · {producto.bulto.label} ({producto.bulto.codigo})
                </span>
              </Atributo>
              <Atributo label="Disponible">
                {formatNumber(producto.bultosDisponibles)} bultos{" "}
                <span className="text-muted-foreground">· {producto.ventas30dBultos} vendidos en 30 días</span>
              </Atributo>
              <Atributo label="Margen del bulto">{formatPercent(producto.margenBulto)}</Atributo>
            </dl>
          </div>

          <Seccion title="Atributos">
            <dl className="divide-y divide-border">
              <Atributo label="Marca">{producto.marca}</Atributo>
              <Atributo label="Tela">{producto.tela}</Atributo>
              <Atributo label="Colores">
                <span className="flex flex-wrap items-center gap-2">
                  <ColorDots colors={producto.colores} />
                  <span className="text-muted-foreground">{producto.colores.join(", ")}</span>
                </span>
              </Atributo>
              <Atributo label="Talles">{producto.talles}</Atributo>
              <Atributo label="Aclaración">{producto.aclaracion}</Atributo>
              <Atributo label="Medidas y peso">
                <span className="tabular-nums">
                  {largo} × {ancho} × {alto} cm · {formatNumber(producto.pesoBultoKg)} kg por bulto
                </span>
              </Atributo>
            </dl>
          </Seccion>

          <Seccion title="Fotos">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {producto.fotos.map((foto) => (
                <li
                  key={foto.tipo}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-xs",
                    foto.cargada ? "border-border bg-muted/40" : "border-dashed border-warning/50 bg-warning/5",
                  )}
                >
                  {foto.cargada ? (
                    <ProductThumb sku="" colors={producto.colores} size="md" />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-lg bg-warning/10 text-warning">
                      <ImageOff aria-hidden className="size-5" />
                    </span>
                  )}
                  <span className="font-medium">{foto.label}</span>
                  <span className={foto.cargada ? "text-muted-foreground" : "font-medium text-warning"}>
                    {foto.cargada ? "Cargada" : "Falta"}
                  </span>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion title="Presentaciones y listas">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {producto.presentaciones.map((item) => (
                <li key={item.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <span className="w-24 font-mono text-xs">{item.codigo}</span>
                  <span className="min-w-0 flex-1">
                    {item.label}
                    {item.esBulto && (
                      <Badge variant="primary" className="ml-2">
                        Bulto mayorista
                      </Badge>
                    )}
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(item.precio)}</span>
                  <span className="w-full text-xs text-muted-foreground sm:w-auto sm:basis-full">
                    {item.listas.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion title="Descripción para el bot y la web">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles aria-hidden className="size-3.5" />
                Generada con IA a partir de los atributos
                <Badge variant={producto.descripcion.revisada ? "success" : "warning"} dot className="ml-auto">
                  {producto.descripcion.revisada ? "Revisada" : "Falta revisar"}
                </Badge>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-pretty">{producto.descripcion.texto}</p>
            </div>
          </Seccion>

          <Seccion title="Dónde está publicado">
            <ul className="flex flex-wrap gap-2">
              {CANALES_PUBLICACION.map(({ key, label }) => {
                const ok = producto.publicado[key];
                const Icon = ok ? Check : X;
                return (
                  <li key={key}>
                    <Badge variant={ok ? "success" : "neutral"}>
                      <Icon aria-hidden className="size-3" />
                      {label}
                      <span className="sr-only">{ok ? ": publicado" : ": sin publicar"}</span>
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Seccion>

          {producto.faltantes.length > 0 && (
            <Seccion title="Salud del producto">
              <ul className="space-y-1.5">
                {producto.faltantes.map((faltante) => (
                  <li key={faltante} className="flex items-start gap-2 text-sm">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    {faltante}
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" asChild>
            <Link href={`/stock/espejo?q=${encodeURIComponent(producto.sku)}`}>
              <Warehouse />
              Ver stock
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
