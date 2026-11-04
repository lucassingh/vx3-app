import { Badge } from "@/components/ui/badge";

/**
 * Marca lo que todavía sale de la API simulada dentro de un módulo que ya lee datos
 * reales (`fase-1.4`, decisión 3), para que nadie lo tome por un dato de DUX.
 */
export function DatosSimulados({ pr }: { pr: string }) {
  return (
    <Badge variant="warning" dot>
      Datos de ejemplo · entra en la PR {pr}
    </Badge>
  );
}
