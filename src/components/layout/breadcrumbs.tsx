"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getBreadcrumbs } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * La ruta es dato de la URL: en rutas con parámetros dinámicos se conoce recién
 * en el request, así que se muestra un skeleton hasta resolverla.
 */
export function Breadcrumbs() {
  return (
    <Suspense fallback={<Skeleton className="h-4 w-36" />}>
      <BreadcrumbTrail />
    </Suspense>
  );
}

function BreadcrumbTrail() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  return (
    <nav aria-label="Ruta de navegación" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li
              key={`${crumb.label}-${index}`}
              className={cn("min-w-0 items-center gap-1.5", last ? "flex" : "hidden sm:flex")}
            >
              {last ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-muted-foreground">{crumb.label}</span>
              )}
              {!last && (
                <span aria-hidden className="select-none text-border-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
