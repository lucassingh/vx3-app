import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { findRoute } from "@/lib/navigation";

export type SearchParams = Record<string, string | string[] | undefined>;

/** Lee un parámetro de la URL como texto (ignora los repetidos). */
export function param(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Eyebrow, título y bajada de una pantalla, tomados de config/navigation.ts. */
export function routeHeader(href: string) {
  const match = findRoute(href);
  return {
    eyebrow: match?.group?.title ?? match?.section?.label,
    title: match?.link.title ?? "",
    description: match?.link.description,
  };
}

/** "Hoy", "Ayer", "Hace 12 días". */
export function diasLabel(dias: number) {
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

export function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} scroll={false}>
        {children}
      </Link>
    </Button>
  );
}

export function Pagination({
  label,
  from,
  to,
  total,
  prevHref,
  nextHref,
}: {
  label: string;
  from: number;
  to: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"
    >
      <p className="text-[13px] text-muted-foreground">
        Mostrando{" "}
        <span className="font-medium text-foreground tabular-nums">
          {from}–{to}
        </span>{" "}
        de <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={prevHref ?? "#"} disabled={!prevHref}>
          <ChevronLeft />
          Anterior
        </PageLink>
        <PageLink href={nextHref ?? "#"} disabled={!nextHref}>
          Siguiente
          <ChevronRight />
        </PageLink>
      </div>
    </nav>
  );
}
