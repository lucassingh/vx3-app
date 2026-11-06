"use client";

import { Check, Eye, LoaderCircle, RotateCcw, Store, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogoBorrador, CatalogoEscrituraEnDux, CatalogoPedidoDeLaTienda } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  avanzarPublicacionEnLaTienda,
  mostrarProductoEnLaTienda,
  verPedidoDeLaTienda,
} from "@/modules/catalog/actions";

/** Vuelta de seguridad: el producto y hasta 10 fotos. */
const MAXIMO_DE_PASOS = 15;

function Pedido({ pedido }: { pedido: CatalogoPedidoDeLaTienda }) {
  const variante = pedido.pedido.variants[0];
  const filas: [string, string][] = [
    ["SKU", variante?.sku ?? "—"],
    ["Nombre", pedido.pedido.name.es],
    [
      "Categoría",
      pedido.ruta
        ? `${pedido.ruta.join(" › ")}${pedido.categoriaId ? ` (ID ${pedido.categoriaId})` : ""}`
        : "Sin regla",
    ],
    ["Descripción", pedido.pedido.description.es || "—"],
    [
      "Peso y medidas",
      `${variante?.weight ?? "—"} kg · ${variante?.depth ?? "—"} × ${variante?.width ?? "—"} × ${variante?.height ?? "—"} cm`,
    ],
    ["Precio", "0, oculto: lo completa DUX por SKU"],
    ["Fotos", formatNumber(pedido.fotos.length)],
  ];
  return (
    <div className="space-y-2">
      {pedido.problema && <p className="text-xs font-medium text-danger">{pedido.problema}</p>}
      <dl className="space-y-1.5 text-xs">
        {filas.map(([titulo, valor]) => (
          <div key={titulo}>
            <dt className="text-muted-foreground">{titulo}</dt>
            <dd className="wrap-anywhere">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Publicar en la tienda, después de DUX. El producto se crea oculto y se muestra aparte, cuando DUX
 * ya le puso el precio. Fuera de producción no se manda nada: se puede ver lo que se mandaría.
 */
export function AltaPublicarEnTienda({
  borradorId,
  estado,
  totalDeFotos,
  escritura,
  alActualizar,
}: {
  borradorId: string;
  estado: CatalogoBorrador["tienda"];
  totalDeFotos: number;
  escritura: CatalogoEscrituraEnDux;
  alActualizar: (borrador: CatalogoBorrador) => void;
}) {
  const [publicando, setPublicando] = useState(false);
  const [mostrando, setMostrando] = useState(false);
  const [cargandoPedido, setCargandoPedido] = useState(false);
  const [pedido, setPedido] = useState<CatalogoPedidoDeLaTienda | null>(null);

  const creado = estado?.productoId != null;
  const subidas = estado?.fotos ?? 0;
  const listo = creado && subidas >= totalDeFotos;
  const ocupado = publicando || mostrando;

  const publicar = async () => {
    setPublicando(true);
    try {
      for (let vuelta = 0; vuelta < MAXIMO_DE_PASOS; vuelta++) {
        const resultado = await avanzarPublicacionEnLaTienda({ id: borradorId });
        if (!resultado.ok) {
          toast.error("No se pudo publicar", { description: resultado.error.message });
          return;
        }
        alActualizar(resultado.data);
        const actual = resultado.data.tienda;
        if (actual?.error) {
          toast.error("Tienda Nube no lo aceptó", { description: actual.detalle ?? undefined });
          return;
        }
        if (actual?.productoId != null && actual.fotos >= totalDeFotos) {
          toast.success("Quedó en la tienda, oculto", { description: "Falta que DUX le ponga el precio." });
          return;
        }
      }
    } finally {
      setPublicando(false);
    }
  };

  const mostrar = async () => {
    setMostrando(true);
    try {
      const resultado = await mostrarProductoEnLaTienda({ id: borradorId });
      if (!resultado.ok) {
        toast.error("Todavía no se puede mostrar", { description: resultado.error.message });
        return;
      }
      alActualizar(resultado.data);
      toast.success("Ya se ve en la tienda");
    } finally {
      setMostrando(false);
    }
  };

  const verPedido = async () => {
    setCargandoPedido(true);
    try {
      const resultado = await verPedidoDeLaTienda({ id: borradorId });
      if (!resultado.ok) {
        toast.error("No se pudo armar el pedido", { description: resultado.error.message });
        return;
      }
      setPedido(resultado.data);
    } finally {
      setCargandoPedido(false);
    }
  };

  if (estado?.visible) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium" role="status">
        <Store aria-hidden className="size-4 text-success" />
        Ya se ve en la tienda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {creado && (
        <p className="flex items-center gap-2 text-sm">
          <Check aria-hidden className="size-4 text-success" />
          En la tienda, oculto. Fotos: {formatNumber(subidas)} de {formatNumber(totalDeFotos)}.
        </p>
      )}
      {estado?.detalle && (
        <p className={estado.error ? "text-xs font-medium text-danger" : "text-xs text-muted-foreground"} role="status">
          {estado.detalle}
        </p>
      )}

      {listo ? (
        <>
          <Button className="w-full" onClick={mostrar} disabled={ocupado || !escritura.puede}>
            {mostrando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Eye />}
            {mostrando ? "Revisando el precio…" : "Mostrar en la tienda"}
          </Button>
          <p className="text-xs text-muted-foreground">
            DUX completa el precio solo, a los pocos minutos. Sin precio no se muestra.
          </p>
        </>
      ) : (
        <Button className="w-full" onClick={publicar} disabled={ocupado || !escritura.puede}>
          {publicando ? <LoaderCircle aria-hidden className="animate-spin" /> : estado ? <RotateCcw /> : <Upload />}
          {publicando ? "Publicando…" : estado ? "Retomar en Tienda Nube" : "Publicar en Tienda Nube"}
        </Button>
      )}
      {escritura.motivo && <p className="text-xs text-muted-foreground">{escritura.motivo}</p>}

      <details className="rounded-lg border border-border p-3 text-sm" open={!escritura.puede}>
        <summary className="cursor-pointer font-medium">Lo que se manda a la tienda</summary>
        <div className="space-y-3 pt-3">
          {pedido ? (
            <Pedido pedido={pedido} />
          ) : (
            <Button type="button" variant="outline" className="w-full" disabled={cargandoPedido} onClick={verPedido}>
              {cargandoPedido ? <LoaderCircle aria-hidden className="animate-spin" /> : <Eye />}
              Ver el pedido
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}
