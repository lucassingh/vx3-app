import { Badge } from "@/components/ui/badge";
import type { EstadoPedido, OrigenVenta, Segmento } from "@/lib/api/types";
import { ESTADO_PEDIDO, ORIGEN_VENTA, SEGMENTO } from "@/lib/domain";

/** Badges de los valores de negocio compartidos (ver lib/domain.ts). */

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  const { label, tone } = ESTADO_PEDIDO[estado];
  return (
    <Badge variant={tone} dot>
      {label}
    </Badge>
  );
}

export function OrigenBadge({ origen }: { origen: OrigenVenta }) {
  const { label, tone } = ORIGEN_VENTA[origen];
  return <Badge variant={tone}>{label}</Badge>;
}

export function SegmentoBadge({ segmento }: { segmento: Segmento }) {
  const { label, tone } = SEGMENTO[segmento];
  return (
    <Badge variant={tone} dot>
      {label}
    </Badge>
  );
}
