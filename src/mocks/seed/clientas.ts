import type { Segmento, Zona } from "@/lib/api/types";

/**
 * Clientas de ejemplo (revendedoras). La identidad es el teléfono normalizado
 * (RN-90): todos los módulos se cruzan por `id`, nunca por número de pedido.
 */

export type OrigenClienta = "anuncio" | "organico" | "local" | "tiendanube";

export type ClientaSeed = {
  id: string;
  nombre: string;
  /** Teléfono normalizado, listo para mostrar. */
  telefono: string;
  localidad: string;
  provincia: string;
  cp: string;
  zona: Zona;
  /** Cómo llegó por primera vez (RF-M12-02). */
  origen: OrigenClienta;
  anuncioOrigenId?: string;
  segmento: Segmento;
  primeraCompraDias: number;
  ultimaCompraDias: number;
  pedidos: number;
  /** Total comprado histórico, en pesos. */
  totalComprado: number;
  /** Ciclo de compra estimado en días (RF-M12-05); null si compró una sola vez. */
  cicloDias: number | null;
};

const c = (
  id: string,
  nombre: string,
  telefono: string,
  localidad: string,
  provincia: string,
  cp: string,
  zona: Zona,
  origen: OrigenClienta,
  anuncioOrigenId: string | undefined,
  segmento: Segmento,
  primeraCompraDias: number,
  ultimaCompraDias: number,
  pedidos: number,
  totalComprado: number,
  cicloDias: number | null,
): ClientaSeed => ({
  id, nombre, telefono, localidad, provincia, cp, zona, origen, anuncioOrigenId, segmento,
  primeraCompraDias, ultimaCompraDias, pedidos, totalComprado, cicloDias,
});

export const clientas: ClientaSeed[] = [
  c("c-01", "Romina Gaitán", "+54 9 11 5832-4410", "Lanús", "Buenos Aires", "1824", "amba_1", "anuncio", "a-01", "top", 210, 0, 14, 1_248_000, 15),
  c("c-02", "Daiana Ferreyra", "+54 9 11 6214-0087", "González Catán", "Buenos Aires", "1759", "amba_2", "anuncio", "a-05", "activa", 9, 0, 4, 286_000, 3),
  c("c-03", "Micaela Roldán", "+54 9 341 592-1180", "Rosario", "Santa Fe", "2000", "interior", "anuncio", "a-03", "activa", 64, 0, 4, 352_000, 18),
  c("c-04", "Johana Quiroga", "+54 9 11 3398-7712", "Flores, CABA", "CABA", "1406", "amba_1", "organico", undefined, "top", 380, 1, 22, 1_940_000, 16),
  c("c-05", "Celeste Benítez", "+54 9 351 610-4423", "Córdoba", "Córdoba", "5000", "interior", "anuncio", "a-02", "nueva", 0, 0, 1, 68_400, null),
  c("c-06", "Valeria Ortiz", "+54 9 11 4402-9931", "Quilmes", "Buenos Aires", "1878", "amba_2", "local", undefined, "en_riesgo", 300, 41, 9, 610_000, 21),
  c("c-07", "Yanina Medina", "+54 9 11 2287-6650", "Moreno", "Buenos Aires", "1744", "amba_2", "anuncio", "a-01", "en_riesgo", 120, 34, 5, 330_000, 18),
  c("c-08", "Florencia Aguirre", "+54 9 261 455-0918", "Mendoza", "Mendoza", "5500", "interior", "tiendanube", undefined, "activa", 95, 5, 5, 412_000, 19),
  c("c-09", "Natalia Sosa", "+54 9 11 5120-3344", "Avellaneda", "Buenos Aires", "1870", "amba_1", "anuncio", "a-04", "nueva", 0, 0, 1, 52_800, null),
  c("c-10", "Melina Castro", "+54 9 381 402-7765", "San Miguel de Tucumán", "Tucumán", "4000", "interior", "organico", undefined, "dormida", 260, 96, 3, 198_000, 30),
  c("c-11", "Brenda Ojeda", "+54 9 11 6655-1290", "Lomas de Zamora", "Buenos Aires", "1832", "amba_1", "anuncio", "a-06", "activa", 48, 0, 5, 318_000, 10),
  c("c-12", "Soledad Paz", "+54 9 223 512-6640", "Mar del Plata", "Buenos Aires", "7600", "interior", "anuncio", "a-03", "en_riesgo", 180, 52, 6, 455_000, 28),
  c("c-13", "Mariela Godoy", "+54 9 11 3021-8876", "Merlo", "Buenos Aires", "1722", "amba_2", "local", undefined, "top", 520, 0, 31, 2_380_000, 14),
  c("c-14", "Agustina Ríos", "+54 9 299 418-2209", "Neuquén", "Neuquén", "8300", "interior", "anuncio", "a-02", "nueva", 0, 0, 1, 74_900, null),
  c("c-15", "Carolina Vera", "+54 9 11 4789-0012", "Morón", "Buenos Aires", "1708", "amba_1", "organico", undefined, "activa", 140, 0, 7, 528_000, 17),
  c("c-16", "Noelia Acosta", "+54 9 387 455-3317", "Salta", "Salta", "4400", "interior", "tiendanube", undefined, "dormida", 300, 120, 2, 131_000, null),
  c("c-17", "Gisela Romero", "+54 9 11 2544-6670", "Florencio Varela", "Buenos Aires", "1888", "amba_2", "anuncio", "a-05", "en_riesgo", 75, 29, 3, 172_000, 12),
  c("c-18", "Lorena Molina", "+54 9 379 462-8801", "Corrientes", "Corrientes", "3400", "interior", "anuncio", "a-03", "activa", 40, 6, 3, 241_000, 14),
  c("c-19", "Antonella Ruiz", "+54 9 11 6012-4458", "San Martín", "Buenos Aires", "1650", "amba_1", "anuncio", "a-04", "activa", 30, 0, 5, 296_500, 7),
  c("c-20", "Tamara Luna", "+54 9 11 3876-5521", "Pilar", "Buenos Aires", "1629", "amba_2", "organico", undefined, "dormida", 410, 88, 6, 402_000, 35),
  c("c-21", "Paola Ibáñez", "+54 9 376 445-1092", "Posadas", "Misiones", "3300", "interior", "anuncio", "a-03", "nueva", 0, 0, 1, 61_200, null),
  c("c-22", "Rocío Herrera", "+54 9 11 5567-3390", "Vicente López", "Buenos Aires", "1638", "amba_1", "local", undefined, "en_riesgo", 230, 38, 8, 590_000, 20),
  c("c-23", "Jésica Ledesma", "+54 9 11 4120-7784", "Berazategui", "Buenos Aires", "1884", "amba_2", "anuncio", "a-06", "activa", 22, 5, 2, 131_600, 9),
  c("c-24", "Vanesa Correa", "+54 9 342 501-6634", "Santa Fe", "Santa Fe", "3000", "interior", "organico", undefined, "top", 450, 0, 18, 1_512_000, 21),
];

const byId = new Map(clientas.map((clienta) => [clienta.id, clienta]));

export function getClienta(id: string) {
  const clienta = byId.get(id);
  if (!clienta) throw new Error(`No existe la clienta ${id} en la semilla.`);
  return clienta;
}

/** Referencia liviana para listas de otros módulos. */
export function clientaRef(id: string) {
  const { nombre, telefono } = getClienta(id);
  return { id, nombre, telefono };
}
