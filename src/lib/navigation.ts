import type { Metadata } from "next";
import { navigation, userNavigation, type NavGroup, type NavLink, type NavSection } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export type RouteMatch = {
  link: NavLink;
  group?: NavGroup;
  section?: NavSection;
};

export type Crumb = { label: string; href?: string };

/** `pathname` null = ruta todavía desconocida (ningún item activo). */
export function isActivePath(pathname: string | null, href: string) {
  if (pathname === null) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pantallas a las que se llega desde otra: no tienen item en el menú, pero sí migas. */
const DESDE_OTRA_PANTALLA: Record<string, { padre: string; title: string; description: string }> = {
  "/productos/editar": {
    padre: "/productos/catalogo",
    title: "Editar producto",
    description: "La ficha y las fotos. Se actualiza en la app y, en producción, en la tienda.",
  },
};

/** Busca una ruta en la navegación del aside y en la del menú de usuario. */
export function findRoute(pathname: string): RouteMatch | undefined {
  const interna = DESDE_OTRA_PANTALLA[pathname];
  if (interna) {
    const padre = findRoute(interna.padre);
    return (
      padre && {
        ...padre,
        link: { ...padre.link, href: pathname, title: interna.title, description: interna.description },
      }
    );
  }

  for (const section of navigation) {
    for (const item of section.items) {
      if (item.items) {
        const link = item.items.find((child) => child.href === pathname);
        if (link) return { link, group: item, section };
      } else if (item.href === pathname) {
        return { link: item, section };
      }
    }
  }

  const link = userNavigation.find((entry) => entry.href === pathname);
  return link ? { link } : undefined;
}

/** Título y descripción de una pantalla, tomados de config/navigation.ts. */
export function getRouteMetadata(href: string): Metadata {
  const match = findRoute(href);
  return { title: match?.link.title, description: match?.link.description };
}

export function getBreadcrumbs(pathname: string): Crumb[] {
  const root: Crumb = { label: siteConfig.name, href: "/" };
  const match = findRoute(pathname);
  if (!match) return [root, { label: "Página no encontrada" }];

  return [
    root,
    ...(match.group ? [{ label: match.group.title }] : []),
    { label: match.link.title, href: match.link.href },
  ];
}
