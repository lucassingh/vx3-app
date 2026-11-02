/**
 * Anuncios de Meta con las métricas de los últimos 7 días. El gasto está en
 * USD (RN-111) y el margen es real, línea por línea con el costo de DUX
 * (RN-92). Totales: 1.034 conversaciones de pauta → 18 pedidos verificados.
 */

/** Tipo de cambio configurable para pasar el gasto de Meta a pesos (RN-111). */
export const TIPO_CAMBIO_USD = 1_450;

/** RN-111: ROAS de equilibrio y objetivo (referencias del semáforo). */
export const ROAS_EQUILIBRIO = 4.35;
export const ROAS_OBJETIVO = 5.5;

export type Semaforo = "escalar" | "mantener" | "revisar" | "apagar";

export type AnuncioSeed = {
  id: string;
  nombre: string;
  campana: string;
  conjunto: string;
  /** SKU que promociona (RF-M9-04); alimenta la primera respuesta del bot. */
  sku: string | null;
  zona: "AMBA" | "Interior" | "Todo el país";
  formato: "Reel" | "Video" | "Carrusel" | "Imagen";
  estado: "activo" | "pausado";
  gastoUsd7d: number;
  impresiones7d: number;
  clics7d: number;
  conversaciones7d: number;
  pedidos7d: number;
  ventas7d: number;
  margen7d: number;
  /** Margen de las recompras posteriores de las clientas que trajo (RF-M9-09). */
  valorRecompra90d: number;
  semaforo: Semaforo;
  motivo: string;
};

export const anuncios: AnuncioSeed[] = [
  { id: "a-01", nombre: "Reel conjunto AmorArma CJATN14", campana: "Mensajes AMBA · contraentrega", conjunto: "AMBA · mujeres 25-55", sku: "CJATN14", zona: "AMBA", formato: "Reel", estado: "activo", gastoUsd7d: 38, impresiones7d: 41_200, clics7d: 1_310, conversaciones7d: 248, pedidos7d: 6, ventas7d: 512_000, margen7d: 118_000, valorRecompra90d: 264_000, semaforo: "escalar", motivo: "RM 2,1 con 6 pedidos: hay margen para subir el presupuesto." },
  { id: "a-04", nombre: "Video conjunto Condeza CJATN31", campana: "Mensajes AMBA · contraentrega", conjunto: "AMBA · mujeres 25-55", sku: "CJATN31", zona: "AMBA", formato: "Video", estado: "activo", gastoUsd7d: 27, impresiones7d: 30_900, clics7d: 960, conversaciones7d: 164, pedidos7d: 4, ventas7d: 398_000, margen7d: 92_000, valorRecompra90d: 121_000, semaforo: "escalar", motivo: "Mejor RM de la semana." },
  { id: "a-03", nombre: "Reel vedetinas segunda piel VN16", campana: "Mensajes Interior", conjunto: "Interior · revendedoras", sku: "VN16", zona: "Interior", formato: "Reel", estado: "activo", gastoUsd7d: 21, impresiones7d: 27_400, clics7d: 802, conversaciones7d: 118, pedidos7d: 3, ventas7d: 238_000, margen7d: 55_000, valorRecompra90d: 187_000, semaforo: "escalar", motivo: "RM 1,8 y las clientas que trae recompran." },
  { id: "a-02", nombre: "Carrusel corpiños Smart Sexy CAN9", campana: "Mensajes Interior", conjunto: "Interior · revendedoras", sku: "CAN9", zona: "Interior", formato: "Carrusel", estado: "activo", gastoUsd7d: 24, impresiones7d: 29_800, clics7d: 744, conversaciones7d: 132, pedidos7d: 3, ventas7d: 226_000, margen7d: 52_000, valorRecompra90d: 48_000, semaforo: "mantener", motivo: "Arriba del equilibrio, sin margen para escalar." },
  { id: "a-05", nombre: "Promo medias por docena", campana: "Captación · promo medias", conjunto: "Todo el país · intereses moda", sku: "MLN10", zona: "Todo el país", formato: "Imagen", estado: "activo", gastoUsd7d: 24, impresiones7d: 52_300, clics7d: 1_920, conversaciones7d: 205, pedidos7d: 1, ventas7d: 52_000, margen7d: 6_800, valorRecompra90d: 236_000, semaforo: "mantener", motivo: "RM bajo a propósito: capta clientas que después recompran (valor de vida alto)." },
  { id: "a-06", nombre: "Reel less Jenifer LN35", campana: "Mensajes AMBA · contraentrega", conjunto: "AMBA · mujeres 18-40", sku: "LN35", zona: "AMBA", formato: "Reel", estado: "activo", gastoUsd7d: 16, impresiones7d: 22_100, clics7d: 590, conversaciones7d: 96, pedidos7d: 1, ventas7d: 61_000, margen7d: 13_900, valorRecompra90d: 92_000, semaforo: "revisar", motivo: "RM 0,6: revisar la creatividad o el público." },
  { id: "a-07", nombre: "Body de encaje BCN2", campana: "Mensajes Interior", conjunto: "Interior · revendedoras", sku: "BCN2", zona: "Interior", formato: "Imagen", estado: "activo", gastoUsd7d: 13, impresiones7d: 14_600, clics7d: 210, conversaciones7d: 41, pedidos7d: 0, ventas7d: 0, margen7d: 0, valorRecompra90d: 0, semaforo: "apagar", motivo: "Gastó USD 13 en 3 días con 0 ventas." },
  { id: "a-08", nombre: "Térmicas Linda Luna IRTM6", campana: "Liquidación invierno", conjunto: "Todo el país · revendedoras", sku: "IRTM6", zona: "Todo el país", formato: "Imagen", estado: "activo", gastoUsd7d: 11, impresiones7d: 12_800, clics7d: 96, conversaciones7d: 18, pedidos7d: 0, ventas7d: 0, margen7d: 0, valorRecompra90d: 0, semaforo: "apagar", motivo: "Fin de temporada: 18 conversaciones y ningún pedido." },
  { id: "a-09", nombre: "Short deportivo Vicblack DSN5", campana: "Mensajes AMBA · contraentrega", conjunto: "AMBA · mujeres 18-40", sku: "DSN5", zona: "AMBA", formato: "Reel", estado: "activo", gastoUsd7d: 6, impresiones7d: 6_900, clics7d: 88, conversaciones7d: 12, pedidos7d: 0, ventas7d: 0, margen7d: 0, valorRecompra90d: 0, semaforo: "revisar", motivo: "Muestra chica: menos de 3 pedidos para decidir." },
  { id: "a-10", nombre: "Pijamas Dlirio PVM3", campana: "Mensajes Interior", conjunto: "Interior · revendedoras", sku: "PVM3", zona: "Interior", formato: "Carrusel", estado: "pausado", gastoUsd7d: 0, impresiones7d: 0, clics7d: 0, conversaciones7d: 0, pedidos7d: 0, ventas7d: 0, margen7d: 0, valorRecompra90d: 54_000, semaforo: "mantener", motivo: "Legado: sin gasto en el período." },
];

/** RM = margen real ÷ gasto en pesos (RN-92). null si no hubo gasto. */
export function rmDe(anuncio: AnuncioSeed) {
  const gasto = anuncio.gastoUsd7d * TIPO_CAMBIO_USD;
  return gasto > 0 ? anuncio.margen7d / gasto : null;
}

const byId = new Map(anuncios.map((anuncio) => [anuncio.id, anuncio]));

export function getAnuncio(id: string) {
  const anuncio = byId.get(id);
  if (!anuncio) throw new Error(`No existe el anuncio ${id} en la semilla.`);
  return anuncio;
}
