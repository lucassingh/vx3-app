import { CheckCheck, Lock, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import { ColorDots, ProductThumb } from "@/components/kit/product-thumb";
import { Meter } from "@/components/kit/meter";
import type { VidrieraVistaProducto } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";

/**
 * Vista previa de la página de producto tal como la ve la clienta en el
 * celular (RF-M4-01, RF-M4-03). Es ilustrativa: el contenido es `inert`.
 */
export function PhonePreview({ vista }: { vista: VidrieraVistaProducto }) {
  const falta = Math.max(0, vista.minimo - vista.carrito);

  return (
    <figure className="space-y-3">
      <div className="mx-auto w-full max-w-[19.5rem] rounded-[2.4rem] border-[9px] border-foreground bg-foreground shadow-popover">
        <div inert className="overflow-hidden rounded-[1.8rem] bg-surface">
          <div className="flex items-center justify-center gap-1.5 bg-muted px-4 pb-2 pt-3 text-[11px] text-muted-foreground">
            <Lock aria-hidden className="size-3" />
            {vista.link}
          </div>

          <div className="relative">
            <ProductThumb sku={vista.sku} colors={vista.colores} size="lg" className="rounded-none border-0" />
            {vista.quedanPocas && (
              <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-warning shadow-card">
                Quedan pocas
              </span>
            )}
            <span className="absolute bottom-7 right-3 flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((dot) => (
                <span key={dot} className={dot === 0 ? "size-1.5 rounded-full bg-white" : "size-1.5 rounded-full bg-white/50"} />
              ))}
            </span>
          </div>

          <div className="space-y-3 p-4">
            <div className="space-y-1">
              <p className="text-[15px] font-semibold leading-snug">{vista.nombre}</p>
              <p className="text-xs text-muted-foreground first-letter:uppercase">
                {vista.aclaracion} · curva {vista.talles}
              </p>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xl font-semibold tabular-nums">{formatCurrency(vista.precio)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {vista.presentacion} · {formatCurrency(vista.precioPrenda)} cada prenda
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-lg border border-border px-1.5 py-1">
                <Minus aria-hidden className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold tabular-nums">1</span>
                <Plus aria-hidden className="size-3.5" />
              </span>
            </div>

            <ColorDots colors={vista.colores} />

            <div className="space-y-1.5 rounded-lg bg-muted/70 p-3">
              <p className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-medium">
                  <ShoppingBag aria-hidden className="size-3.5" />
                  Tu pedido: {formatCurrency(vista.carrito)}
                </span>
                <span className="text-muted-foreground">mínimo {formatCurrency(vista.minimo)}</span>
              </p>
              <Meter
                value={vista.carrito}
                max={vista.minimo}
                label="Avance al pedido mínimo"
                valueText={`${formatCurrency(vista.carrito)} de ${formatCurrency(vista.minimo)}`}
              />
              <p className="text-[11px] text-muted-foreground">
                {falta > 0 ? `Te faltan ${formatCurrency(falta)} para el mínimo mayorista` : "Llegaste al mínimo mayorista"}
              </p>
            </div>

            <span className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground">
              <MessageCircle aria-hidden className="size-4" />
              Enviar mi pedido por WhatsApp
            </span>
          </div>
        </div>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        Así ve la clienta el link que le manda el bot
      </figcaption>
    </figure>
  );
}

/** Tarjeta que arma WhatsApp al compartir el link del producto (RF-M4-07). */
export function LinkPreview({ vista }: { vista: VidrieraVistaProducto }) {
  return (
    <figure className="space-y-3">
      <div inert className="ml-auto max-w-[19rem] rounded-2xl rounded-br-md bg-primary/10 p-1.5">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex gap-3 p-2">
            <ProductThumb sku={vista.sku} colors={vista.colores} size="md" className="size-16" />
            <div className="min-w-0 space-y-0.5 py-0.5">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{vista.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(vista.precio)} la {vista.presentacion.toLowerCase()}
              </p>
              <p className="text-[11px] text-muted-foreground">vx3.com.ar</p>
            </div>
          </div>
        </div>
        <p className="px-2 pb-1 pt-2 text-[13px]">
          Te dejo el link para verlo completo: <span className="font-medium underline underline-offset-2">{vista.link}</span>
        </p>
        <p className="flex items-center justify-end gap-1 px-2 pb-1 text-[11px] text-muted-foreground">
          11:42
          <CheckCheck aria-hidden className="size-3.5" />
        </p>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        La vista previa del link en WhatsApp, con foto, nombre y precio
      </figcaption>
    </figure>
  );
}
