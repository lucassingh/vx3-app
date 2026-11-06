import { formatNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import {
  armarDesdeLasCopias,
  BLOQUEO_DEL_CATALOGO,
  leerYCopiarDrive,
  leerYCopiarSheet,
  type Lectura,
  type ResumenDeImportacion,
} from "@/modules/catalog/importar";
import { credencialEnmascarada } from "@/modules/platform/credentials/service";
import {
  abrirCorrida,
  cerrarCorrida,
  soltarBloqueo,
  tomarBloqueo,
  type OrigenDeCorrida,
} from "@/modules/platform/sync-runs";

/**
 * La importación del catálogo (`solucion_doc/06` §6.2). Cada fuente es un paso: la lectura del
 * Sheet llegó a tardar minutos. Lo leído queda en las copias crudas, así que los pasos no se
 * pasan nada pesado.
 */

export const OPERACION_DEL_CATALOGO = "catalogo";
/** Las esperas de Google pueden sumar varios minutos. Es solo por si el Workflow muere antes. */
export const VENCE_IMPORTACION_MS = 30 * 60_000;

export async function importarCatalogo(origen: OrigenDeCorrida, bloqueo: string) {
  "use workflow";

  try {
    const corrida = await abrirImportacion(origen);
    const sheet = await leerSheetDelCatalogo();
    if (!sheet.ok) return await cerrarImportacionFallida(corrida, sheet, sheet.motivo);
    const drive = await leerDriveDelCatalogo();
    if (!drive.ok)
      return await cerrarImportacionFallida(
        corrida,
        { ...drive, llamadas: sheet.llamadas + drive.llamadas },
        drive.motivo,
      );
    const resumen = await armarCatalogoDesdeLasCopias();
    return await cerrarImportacion(corrida, { sheet, drive, resumen });
  } finally {
    await soltarBloqueoDelCatalogo(bloqueo);
  }
}

/**
 * Corre con lo que DUX acaba de traer. Sin la clave cargada no hace nada: en ese ambiente el
 * catálogo todavía no está conectado. Si hay otra en curso, tampoco: esa ya lo va a dejar al día.
 */
export async function importarCatalogoTrasDux(origen: OrigenDeCorrida) {
  "use workflow";

  const bloqueo = await tomarBloqueoTrasDux();
  if (!bloqueo) return { status: "omitida" as const };
  return importarCatalogo(origen, bloqueo);
}

export async function tomarBloqueoTrasDux() {
  "use step";

  if (!(await credencialEnmascarada("google"))) return null;
  return tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_IMPORTACION_MS);
}

export async function abrirImportacion(origen: OrigenDeCorrida) {
  "use step";

  const { id } = await abrirCorrida(BLOQUEO_DEL_CATALOGO, OPERACION_DEL_CATALOGO, origen);
  return { id };
}

export async function leerSheetDelCatalogo(): Promise<Lectura> {
  "use step";

  return leerYCopiarSheet();
}

export async function leerDriveDelCatalogo(): Promise<Lectura> {
  "use step";

  return leerYCopiarDrive();
}

export async function armarCatalogoDesdeLasCopias(): Promise<ResumenDeImportacion> {
  "use step";

  return armarDesdeLasCopias(new Date());
}

export async function cerrarImportacion(
  corrida: { id: string },
  {
    sheet,
    drive,
    resumen,
  }: {
    sheet: Extract<Lectura, { ok: true }>;
    drive: Extract<Lectura, { ok: true }>;
    resumen: ResumenDeImportacion;
  },
) {
  "use step";

  const n = (valor: number) => formatNumber(valor);
  const { productos, enLasTres, nuevos, cambiados, yaNoEstan, paraRevisar } = resumen;
  await cerrarCorrida(corrida.id, {
    status: "ok",
    calls: sheet.llamadas + drive.llamadas,
    records: productos,
    detail: `Productos: ${n(productos)}, ${n(enLasTres)} en las tres fuentes. Nuevos: ${n(nuevos)}. Cambiados: ${n(cambiados)}. Ya no están: ${n(yaNoEstan)}. Para revisar: ${n(paraRevisar)}. Filas del Sheet: ${n(sheet.registros)}. Archivos de Drive: ${n(drive.registros)}.`,
  });
  logger.info({ corrida: corrida.id, ...resumen }, "catálogo importado");
  return { status: "ok" as const };
}

export async function cerrarImportacionFallida(
  corrida: { id: string },
  { llamadas }: { llamadas: number },
  motivo: string,
) {
  "use step";

  await cerrarCorrida(corrida.id, {
    status: "error",
    calls: llamadas,
    records: 0,
    detail: `${motivo} El catálogo sigue como estaba.`,
  });
  logger.warn({ corrida: corrida.id }, "catálogo: importación cortada");
  return { status: "error" as const };
}

export async function soltarBloqueoDelCatalogo(bloqueo: string) {
  "use step";

  await soltarBloqueo(BLOQUEO_DEL_CATALOGO, bloqueo);
}
