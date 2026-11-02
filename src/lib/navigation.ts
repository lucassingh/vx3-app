import type { Metadata } from "next";
import {
  navigation,
  userNavigation,
  type NavGroup,
  type NavLink,
  type NavSection,
} from "@/config/navigation";
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

/** Busca una ruta en la navegación del aside y en la del menú de usuario. */
export function findRoute(pathname: string): RouteMatch | undefined {
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
