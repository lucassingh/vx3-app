/**
 * Roles y permisos (solucion_doc/06 §4, tecnica_doc §6.3). Es la fuente de
 * verdad: el control de acceso del servidor, el menú y la tarjeta "Roles y
 * permisos" leen de acá. Agregar un rol o un área es tocar solo este archivo
 * (y su test, que repasa la matriz celda por celda).
 *
 * Cada área tiene dos permisos: ver (`pedidos.ver`) y editar (`pedidos.editar`).
 * Editar incluye ver. Los nombres quedan en castellano, como en la maqueta.
 */

export const ROLES = ["admin", "operaciones", "postventa", "compras", "marketing", "solo_lectura"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { nombre: string; quien: string }> = {
  admin: { nombre: "Administración", quien: "Socios y Más Uno" },
  operaciones: { nombre: "Operaciones", quien: "Leo" },
  postventa: { nombre: "Post-venta", quien: "Lucía" },
  compras: { nombre: "Compras", quien: "Juan" },
  marketing: { nombre: "Marketing", quien: "A definir" },
  solo_lectura: { nombre: "Solo lectura", quien: "Contador, mensajería" },
};

export const AREAS = [
  { id: "conversaciones", nombre: "Conversaciones y clientas" },
  { id: "pedidos", nombre: "Pedidos y facturación" },
  { id: "cobros", nombre: "Cobros y conciliación" },
  { id: "envios", nombre: "Envíos y etiquetas" },
  { id: "reclamos", nombre: "Reclamos y notas de crédito" },
  { id: "catalogo", nombre: "Catálogo y altas" },
  { id: "compras", nombre: "Compras, costos y precios" },
  { id: "pauta", nombre: "Pauta y presupuestos" },
  { id: "bot", nombre: "Bot y reglas de negocio" },
  { id: "plataforma", nombre: "Integraciones, IA y usuarios" },
] as const;

export type Area = (typeof AREAS)[number]["id"];

export type Nivel = "edita" | "ve" | "no";

export type Permission = `${Area}.${"ver" | "editar"}`;

// Una letra por rol, en el orden de ROLES (admin, operaciones, postventa,
// compras, marketing, solo_lectura). E = edita · V = ve · - = sin acceso.
const MATRIZ: Record<Area, string> = {
  conversaciones: "EEE-V-",
  pedidos: "EEV--V",
  cobros: "EE---V",
  envios: "EEE--V",
  reclamos: "EVE---",
  catalogo: "EEVEV-",
  compras: "EE-E-V",
  pauta: "E---EV",
  bot: "EV--V-",
  plataforma: "E-----",
};

const NIVELES: Record<string, Nivel> = { E: "edita", V: "ve", "-": "no" };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function nivel(role: Role, area: Area): Nivel {
  const codigo = MATRIZ[area][ROLES.indexOf(role)];
  return (codigo ? NIVELES[codigo] : undefined) ?? "no";
}

/** Si el rol tiene el permiso. Lo que no está en la matriz, no se puede. */
export function can(role: Role, permission: Permission): boolean {
  const [area, accion] = permission.split(".") as [Area, "ver" | "editar"];
  const actual = nivel(role, area);
  return accion === "ver" ? actual !== "no" : actual === "edita";
}

/** La matriz completa, para la tarjeta "Roles y permisos". */
export function matrizDePermisos() {
  return {
    roles: ROLES.map((id) => ({ id, ...ROLE_INFO[id] })),
    areas: AREAS.map((area) => ({
      ...area,
      permisos: Object.fromEntries(ROLES.map((role) => [role, nivel(role, area.id)])) as Record<Role, Nivel>,
    })),
  };
}
