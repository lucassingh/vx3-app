import type { IntegracionEstado } from "@/lib/api/types";

/**
 * Cómo está una integración, según sus últimas corridas (RF-M0-04). Sin base ni red.
 */

/** Lo que lee una sincronización completa con DUX, con el nombre que se le muestra a una persona. */
export const LECTURAS_DUX: Record<string, string> = {
  items: "Productos, stock y precios",
  ventas: "Ventas",
  clientas: "Clientas",
};

/** La corrida es diaria (vercel.json): con este margen, una que se atrasa un rato no alarma. */
const ATRASO_MAXIMO_H = 26;
const HORA_MS = 3_600_000;

export function estaAlDia(terminada: Date | null, ahora: Date): boolean {
  return terminada !== null && ahora.getTime() - terminada.getTime() < ATRASO_MAXIMO_H * HORA_MS;
}

/** QA y local no tienen cron: ahí solo corre con el botón (`fase-1.4`, decisión 2). */
export function frecuenciaDeDux(ambiente = process.env.APP_ENV): string {
  return ambiente === "production" ? "Una vez por día, y con el botón" : "Solo con el botón en este ambiente";
}

export type UltimaCorrida = {
  operation: string;
  status: "ok" | "con_errores" | "error";
  finishedAt: Date | null;
  detail: string | null;
};

type Entrada = { tieneCredencial: boolean; ultimas: UltimaCorrida[]; ahora: Date };

export function estadoDeDux({ tieneCredencial, ultimas, ahora }: Entrada): {
  estado: IntegracionEstado;
  motivo: string;
} {
  if (!tieneCredencial) {
    return { estado: "pendiente", motivo: "Todavía no se cargó el token: cargalo para empezar a sincronizar." };
  }
  if (ultimas.length === 0) {
    return { estado: "pendiente", motivo: "El token está cargado, pero todavía no se sincronizó." };
  }

  const fallidas = ultimas.filter(({ status }) => status !== "ok");
  const primera = fallidas[0];
  if (primera) {
    const todasCaidas = fallidas.length === Object.keys(LECTURAS_DUX).length && fallidas.every(soloError);
    const nombre = LECTURAS_DUX[primera.operation] ?? primera.operation;
    const motivo = `${nombre}: ${primera.detail ?? "falló la última lectura."}`;
    return { estado: todasCaidas ? "caido" : "degradado", motivo };
  }

  const faltante = Object.keys(LECTURAS_DUX).find((operacion) => !ultimas.some((u) => u.operation === operacion));
  if (faltante) return { estado: "degradado", motivo: `${LECTURAS_DUX[faltante]}: todavía no se leyó.` };

  const ultima = Math.max(...ultimas.map(({ finishedAt }) => finishedAt?.getTime() ?? 0));
  const horas = Math.floor((ahora.getTime() - ultima) / HORA_MS);
  if (horas >= ATRASO_MAXIMO_H) {
    return { estado: "degradado", motivo: `La última sincronización terminó hace ${horas} horas.` };
  }
  return { estado: "ok", motivo: "Productos, stock, precios, ventas y clientas al día. Solo lectura." };
}

const soloError = ({ status }: UltimaCorrida) => status === "error";

/** Sale de la última lectura de la tienda. Si falló, la foto anterior sigue entera. */
export function estadoDeLaTienda({
  tieneCredencial,
  ultima,
  fueraDeLasSecciones,
  ahora,
}: {
  tieneCredencial: boolean;
  ultima: UltimaCorrida | null;
  fueraDeLasSecciones: number;
  ahora: Date;
}): { estado: IntegracionEstado; motivo: string } {
  if (!tieneCredencial) {
    return {
      estado: "pendiente",
      motivo: "Publicación de productos, y lectura de lo publicado. Falta cargar el token.",
    };
  }
  if (!ultima) return { estado: "pendiente", motivo: "El token está cargado: apretá Leer la tienda." };
  if (ultima.status !== "ok") return { estado: "caido", motivo: ultima.detail ?? "Falló la última lectura." };
  if (!estaAlDia(ultima.finishedAt, ahora)) {
    const horas = Math.floor((ahora.getTime() - (ultima.finishedAt?.getTime() ?? 0)) / HORA_MS);
    return { estado: "degradado", motivo: `La última lectura terminó hace ${horas} horas.` };
  }
  if (fueraDeLasSecciones > 0) {
    return {
      estado: "degradado",
      motivo: `${fueraDeLasSecciones === 1 ? "Hay 1 producto" : `Hay ${fueraDeLasSecciones} productos`} fuera de las secciones: no ${fueraDeLasSecciones === 1 ? "aparece" : "aparecen"} en el menú de la tienda.`,
    };
  }
  return { estado: "ok", motivo: "Lo publicado está al día, y todo cuelga de una sección." };
}

/** Sale de la última importación del catálogo. Si falló, el catálogo anterior sigue entero. */
export function estadoDeGoogle({
  tieneCredencial,
  ultima,
  ahora,
  cortado = false,
}: {
  tieneCredencial: boolean;
  ultima: UltimaCorrida | null;
  ahora: Date;
  /** Después del corte, el Sheet y Drive ya no se leen. */
  cortado?: boolean;
}): { estado: IntegracionEstado; motivo: string } {
  if (cortado) {
    return { estado: "ok", motivo: "Con el corte hecho, ya no se lee: el catálogo se edita en la app y lee DUX." };
  }
  if (!tieneCredencial) {
    return { estado: "pendiente", motivo: "De acá sale el catálogo hasta el pase. Falta cargar la clave." };
  }
  if (!ultima)
    return { estado: "pendiente", motivo: "La clave está cargada: apretá Reimportar para traer el catálogo." };
  if (ultima.status !== "ok") return { estado: "caido", motivo: ultima.detail ?? "Falló la última importación." };
  if (!estaAlDia(ultima.finishedAt, ahora)) {
    const horas = Math.floor((ahora.getTime() - (ultima.finishedAt?.getTime() ?? 0)) / HORA_MS);
    return { estado: "degradado", motivo: `La última importación terminó hace ${horas} horas.` };
  }
  return { estado: "ok", motivo: "El catálogo está al día con el Sheet, Drive y DUX. Solo lectura." };
}
