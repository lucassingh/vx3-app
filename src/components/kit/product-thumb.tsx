import { swatchFor } from "@/lib/swatches";
import { cn } from "@/lib/utils";

const sizeClass = {
  sm: "size-9 rounded-lg text-[9px]",
  md: "size-12 rounded-lg text-[10px]",
  lg: "aspect-square w-full rounded-xl text-xs",
} as const;

/**
 * Miniatura del producto mientras no estén las fotos migradas: la curva de
 * colores real como franjas y el SKU encima. Es decorativa (el nombre del
 * producto siempre está al lado como texto).
 */
export function ProductThumb({
  sku,
  colors,
  size = "md",
  className,
}: {
  sku: string;
  colors: string[];
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const stripes = colors.slice(0, 6);

  return (
    <span
      aria-hidden
      className={cn(
        "relative isolate flex shrink-0 overflow-hidden border border-border bg-muted",
        sizeClass[size],
        className,
      )}
    >
      {stripes.map((color, index) => (
        <span key={`${color}-${index}`} className="h-full flex-1" style={{ background: swatchFor(color) }} />
      ))}
      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-1 pb-0.5 pt-3 text-center font-mono font-semibold leading-none tracking-tight text-white">
        {sku}
      </span>
    </span>
  );
}

/** Puntos de color de la curva, con el nombre de cada color para lectores de pantalla. */
export function ColorDots({ colors, max = 8 }: { colors: string[]; max?: number }) {
  const visible = colors.slice(0, max);
  const rest = colors.length - visible.length;

  return (
    <span className="inline-flex items-center gap-1" aria-label={`Colores: ${colors.join(", ")}`} role="img">
      {visible.map((color, index) => (
        <span
          key={`${color}-${index}`}
          aria-hidden
          className="size-3 rounded-full ring-1 ring-foreground/15"
          style={{ background: swatchFor(color) }}
        />
      ))}
      {rest > 0 && (
        <span aria-hidden className="text-[11px] text-muted-foreground">
          +{rest}
        </span>
      )}
    </span>
  );
}
