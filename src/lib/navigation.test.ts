import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { navigation, userNavigation, type NavLink } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { findRoute, getBreadcrumbs, getRouteMetadata, isActivePath } from "./navigation";

// Las expectativas salen de config/navigation.ts: siguen valiendo al rebrandear.
const items = navigation.flatMap((section) => section.items);
const group = items.find((item) => item.items !== undefined);
const links: NavLink[] = [
  ...items.flatMap((item) => (item.items ? item.items : [item])),
  ...userNavigation,
];

describe("config/navigation", () => {
  it("cada href tiene su page.tsx en src/app/(dashboard)", () => {
    const missing = links
      .map((link) => link.href)
      .filter((href) => {
        const page = join(process.cwd(), "src/app/(dashboard)", href, "page.tsx");
        return !existsSync(page);
      });
    expect(missing, "Creá estas pantallas o quitalas de la navegación").toEqual([]);
  });

  it("no repite hrefs dentro del aside", () => {
    const hrefs = items.flatMap((item) => (item.items ? item.items : [item])).map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("isActivePath", () => {
  it("la raíz solo está activa en /", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/otra", "/")).toBe(false);
  });

  it("marca la ruta exacta y sus subrutas, sin falsos prefijos", () => {
    expect(isActivePath("/item-1", "/item-1")).toBe(true);
    expect(isActivePath("/item-1/detalle", "/item-1")).toBe(true);
    expect(isActivePath("/item-10", "/item-1")).toBe(false);
  });
});

describe("findRoute y getBreadcrumbs", () => {
  it("resuelve un subitem con su grupo y su sección", () => {
    if (!group) return;
    const child = group.items[0];
    const match = findRoute(child.href);

    expect(match?.link.title).toBe(child.title);
    expect(match?.group?.title).toBe(group.title);
    expect(getBreadcrumbs(child.href)).toEqual([
      { label: siteConfig.name, href: "/" },
      { label: group.title },
      { label: child.title, href: child.href },
    ]);
  });

  it("incluye los links del menú de usuario", () => {
    const [link] = userNavigation;
    expect(findRoute(link.href)?.link.title).toBe(link.title);
  });

  it("devuelve un breadcrumb de 'no encontrada' para rutas desconocidas", () => {
    expect(findRoute("/no-existe")).toBeUndefined();
    expect(getBreadcrumbs("/no-existe").at(-1)).toEqual({ label: "Página no encontrada" });
  });

  it("toma el título de la pantalla para la metadata", () => {
    const [first] = links;
    expect(getRouteMetadata(first.href).title).toBe(first.title);
  });
});
