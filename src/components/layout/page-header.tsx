import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Mismo padding lateral para el header y el cuerpo: todo queda alineado. */
const gutter = "px-4 sm:px-6 lg:px-8";

type PageHeaderProps = {
  title: string;
  /** Línea chica sobre el título (fecha, sección, etc.). */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Botones alineados a la derecha. */
  actions?: React.ReactNode;
};

function PageHeaderFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden border-b border-border bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 -right-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent)] opacity-[0.07] dark:opacity-[0.09]"
      />
      <div
        className={cn("flex w-full flex-col gap-5 py-7 sm:flex-row sm:items-end sm:justify-between lg:py-9", gutter)}
      >
        {children}
      </div>
    </div>
  );
}

/** Banda superior de cada pantalla: blanca, separada del área gris por una línea. */
export function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <PageHeaderFrame>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <div className="text-[13px] text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem] sm:leading-9">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </PageHeaderFrame>
  );
}

export function PageHeaderSkeleton() {
  return (
    <PageHeaderFrame>
      <div className="w-full space-y-2.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
    </PageHeaderFrame>
  );
}

/**
 * Contenedor del contenido de cada pantalla, sobre el fondo gris del canvas.
 * El padding es igual en los cuatro lados.
 */
export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("w-full space-y-6 py-4 sm:py-6 lg:py-8", gutter, className)} {...props} />;
}
