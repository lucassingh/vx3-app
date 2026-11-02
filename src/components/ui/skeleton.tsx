import { cn } from "@/lib/utils";

/**
 * Bloque de carga con brillo (shimmer). Es decorativo: anunciá la carga con
 * <LoadingLabel>. Para estructuras comunes usá los presets de
 * components/views/skeletons.tsx.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-foreground/7",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-white/60 before:to-transparent dark:before:via-white/6",
        className,
      )}
      {...props}
    />
  );
}

/** Texto para lectores de pantalla mientras se carga un bloque. */
export function LoadingLabel({ children = "Cargando…" }: { children?: React.ReactNode }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  );
}
