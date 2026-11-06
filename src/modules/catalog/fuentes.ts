import type { FilaDelSheet } from "./armar";

/**
 * Cómo se lee la pestaña del Sheet. Sin base ni red.
 *
 * Las columnas se buscan por nombre exacto. Si una cambió de nombre, se frena en vez de cargar
 * el dato vacío: el catálogo diría que falta en todos los productos, sin ningún error.
 */

export const PESTANA_DEL_CATALOGO = "CatalogoDetalle";

/** `sku_nuevo` y `sku_venta` no están acá: se leen si existen. */
const COLUMNAS_QUE_SE_LEEN = [
  "SKU",
  "Nombre de DUX",
  "marca_comercial",
  "curva_colores",
  "curva_talles",
  "copa",
  "encaje",
  "push_up",
  "aro",
  "elastico",
  "tipo_bretel",
  "gancho_espalda",
  "tela",
  "otros_detalles",
  "largo",
  "ancho",
  "alto",
  "peso",
  "categoria_tn",
  "subcategoria_tn",
  "Proveedor",
];

export type LecturaDelSheet = { ok: true; filas: FilaDelSheet[] } | { ok: false; motivo: string };

export function leerPestana(pestanas: { titulo: string; visto: string[][]; crudo: unknown[][] }[]): LecturaDelSheet {
  const pestana = pestanas.find(({ titulo }) => titulo === PESTANA_DEL_CATALOGO);
  if (!pestana) return { ok: false, motivo: `El Sheet no tiene la pestaña ${PESTANA_DEL_CATALOGO}.` };

  const encabezados = (pestana.visto[0] ?? []).map((encabezado) => encabezado.trim());
  const faltantes = COLUMNAS_QUE_SE_LEEN.filter((columna) => !encabezados.includes(columna));
  if (faltantes.length > 0) {
    return {
      ok: false,
      motivo: `En el Sheet falta o cambió de nombre: ${faltantes.join(", ")}.`,
    };
  }

  const filas = pestana.visto.slice(1).flatMap((valores, indice): FilaDelSheet[] => {
    if (!valores.some((valor) => valor.trim())) return [];
    const crudos = pestana.crudo[indice + 1] ?? [];
    return [
      {
        fila: indice + 2,
        visto: Object.fromEntries(encabezados.map((encabezado, c) => [encabezado, (valores[c] ?? "").trim()])),
        crudo: Object.fromEntries(encabezados.map((encabezado, c) => [encabezado, crudos[c] ?? null])),
      },
    ];
  });
  if (filas.length === 0) return { ok: false, motivo: "El Sheet volvió sin filas." };
  return { ok: true, filas };
}
