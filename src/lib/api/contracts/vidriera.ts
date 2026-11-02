import type { ApiRequest } from "../http";
import type { EmbudoPaso, Kpi } from "../types";

/** M4 · Vidriera: catálogo propio para la clienta, armado por API (ADR-05). */

export type VidrieraColeccion = {
  id: string;
  nombre: string;
  descripcion: string;
  productos: number;
  activa: boolean;
  /** Visitas de los últimos 7 días. */
  visitas7d: number;
};

export type VidrieraDestacado = {
  sku: string;
  nombre: string;
  colores: string[];
  precio: number;
  presentacion: string;
  stockBultos: number;
  vistas7d: number;
  activo: boolean;
};

/** RF-M4-09: catálogo público o precios mayoristas solo para clientas identificadas (a confirmar, Q-3B). */
export type VidrieraAcceso = "publico" | "con_codigo";

/** La página de producto que manda el bot (RF-M4-01). */
export type VidrieraVistaProducto = {
  sku: string;
  link: string;
  nombre: string;
  aclaracion: string;
  presentacion: string;
  prendas: number;
  precio: number;
  precioPrenda: number;
  talles: string;
  colores: string[];
  stockBultos: number;
  quedanPocas: boolean;
  tela: string | null;
  /** Carrito de ejemplo para la barra de avance al mínimo. */
  carrito: number;
  minimo: number;
};

export type VidrieraResumen = {
  kpis: Kpi[];
  embudo: EmbudoPaso[];
  colecciones: VidrieraColeccion[];
  destacados: VidrieraDestacado[];
  acceso: VidrieraAcceso;
  vista: VidrieraVistaProducto;
};

export function vidrieraEndpoints(request: ApiRequest) {
  const json = (method: string, body: object): RequestInit => ({ method, body: JSON.stringify(body) });

  return {
    resumen: () => request<VidrieraResumen>("/vidriera"),
    ordenarColecciones: (ids: string[]) =>
      request<VidrieraColeccion[]>("/vidriera/colecciones/orden", json("POST", { ids })),
    actualizarColeccion: (id: string, cambios: { activa: boolean }) =>
      request<VidrieraColeccion>(`/vidriera/colecciones/${encodeURIComponent(id)}`, json("PATCH", cambios)),
    actualizarDestacado: (sku: string, cambios: { activo: boolean }) =>
      request<VidrieraDestacado>(`/vidriera/destacados/${encodeURIComponent(sku)}`, json("PATCH", cambios)),
    cambiarAcceso: (acceso: VidrieraAcceso) =>
      request<{ acceso: VidrieraAcceso }>("/vidriera/acceso", json("PATCH", { acceso })),
  };
}
