import type { NavItem, NavSection } from "@/config/navigation";
import { type Area, can, type Role } from "./permissions";

/**
 * A qué área de la matriz (permissions.ts) pertenece cada pantalla y cada ruta
 * de la API. Gana el prefijo más largo. Lo que no figura (el Inicio, Mi perfil,
 * Ajustes, las notificaciones) lo usa cualquiera con sesión.
 */

type Tabla = readonly (readonly [prefijo: string, area: Area])[];

const PAGINAS: Tabla = [
  ["/conversaciones", "conversaciones"],
  ["/clientas", "conversaciones"],
  ["/vidriera", "conversaciones"],
  ["/pauta", "pauta"],
  ["/bot", "bot"],
  ["/pedidos", "pedidos"],
  ["/envios", "envios"],
  ["/cobros", "cobros"],
  ["/postventa", "reclamos"],
  ["/productos", "catalogo"],
  // El espejo de stock es parte del catálogo; costos, compras y proveedores no.
  ["/stock/espejo", "catalogo"],
  ["/stock", "compras"],
  ["/configuracion/reglas", "bot"],
  ["/configuracion", "plataforma"],
];

const API: Tabla = [
  ["/conversaciones", "conversaciones"],
  ["/clientas", "conversaciones"],
  ["/vidriera", "conversaciones"],
  ["/pauta", "pauta"],
  ["/bot", "bot"],
  ["/pedidos", "pedidos"],
  ["/envios", "envios"],
  ["/cobros", "cobros"],
  ["/postventa", "reclamos"],
  ["/catalogo", "catalogo"],
  ["/stock/espejo", "catalogo"],
  ["/stock/kpis", "catalogo"],
  ["/stock/diferencias", "catalogo"],
  ["/stock/sync", "catalogo"],
  ["/stock", "compras"],
  ["/plataforma/reglas", "bot"],
  ["/plataforma/integraciones", "plataforma"],
  ["/plataforma/ia", "plataforma"],
  ["/plataforma/usuarios", "plataforma"],
  ["/plataforma/auditoria", "plataforma"],
];

function buscar(tabla: Tabla, path: string): Area | null {
  const limpio = path.split("?")[0] ?? path;
  let mejor: (typeof tabla)[number] | undefined;
  for (const fila of tabla) {
    const [prefijo] = fila;
    const coincide = limpio === prefijo || limpio.startsWith(`${prefijo}/`);
    if (coincide && (!mejor || prefijo.length > mejor[0].length)) mejor = fila;
  }
  return mejor?.[1] ?? null;
}

export function areaDePagina(pathname: string): Area | null {
  return buscar(PAGINAS, pathname);
}

/** `path` sin el prefijo /api/v1: "/cobros/caja". */
export function areaDeApi(path: string): Area | null {
  return buscar(API, path);
}

export function puedeVerPagina(role: Role, pathname: string) {
  const area = areaDePagina(pathname);
  return area === null || can(role, `${area}.ver`);
}

/** El menú con lo que el rol puede ver: grupos y secciones vacías desaparecen. */
export function navegacionPara(role: Role, secciones: NavSection[]): NavSection[] {
  return secciones
    .map((seccion) => ({
      ...seccion,
      items: seccion.items.flatMap((item): NavItem[] => {
        if (!item.items) return puedeVerPagina(role, item.href) ? [item] : [];
        const visibles = item.items.filter((link) => puedeVerPagina(role, link.href));
        return visibles.length > 0 ? [{ ...item, items: visibles }] : [];
      }),
    }))
    .filter((seccion) => seccion.items.length > 0);
}
