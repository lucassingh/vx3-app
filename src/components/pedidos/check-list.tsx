import { CircleAlert, CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckState = "ok" | "aviso" | "falla" | "na";

const checkIcon = {
  ok: { icon: CircleCheck, className: "text-success", label: "Bien" },
  aviso: { icon: CircleAlert, className: "text-warning", label: "Aviso" },
  falla: { icon: CircleX, className: "text-danger", label: "Falla" },
  na: { icon: CircleMinus, className: "text-muted-foreground", label: "No aplica" },
} as const;

/** Ícono de estado de un chequeo, con su nombre para lectores de pantalla. */
export function CheckIcon({ state, className }: { state: CheckState; className?: string }) {
  const { icon: Icon, className: tone, label } = checkIcon[state];
  return (
    <>
      <Icon aria-hidden className={cn("size-4 shrink-0", tone, className)} />
      <span className="sr-only">{label}: </span>
    </>
  );
}

/** Lista de chequeos con ícono, título y detalle. */
export function CheckList({
  items,
  className,
}: {
  items: { id: string; label: string; detalle: string; estado: CheckState }[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 flex">
            <CheckIcon state={item.estado} />
          </span>
          <span className="min-w-0">
            <span className="font-medium">{item.label}</span>
            <span className="block text-[13px] text-muted-foreground">{item.detalle}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
