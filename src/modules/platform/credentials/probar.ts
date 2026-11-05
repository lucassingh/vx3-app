import "server-only";
import { duxClient } from "@/integrations/dux";
import { fuentesDelCatalogo, googleClient } from "@/integrations/google";
import type { PruebaConexion } from "@/lib/api/types";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import type { IntegracionConCredencial } from "./integraciones";

/** Una sola espera: en una prueba, una persona está mirando la pantalla. */
const ESPERAS_MS = [3_000];

const PRUEBAS: Record<IntegracionConCredencial, () => Promise<string>> = {
  dux: async () => {
    const cliente = await duxClient({ esperasMs: ESPERAS_MS });
    const { items } = await cliente.probarConexion();
    return `DUX respondió: ${formatNumber(items)} items en el catálogo.`;
  },
  google: async () => {
    const { sheetId, carpetaId } = fuentesDelCatalogo();
    const cliente = await googleClient({ esperasMs: ESPERAS_MS, timeoutMs: 30_000 });
    const [sheet, carpeta, foto] = await Promise.all([
      cliente.verificar(sheetId),
      cliente.verificar(carpetaId),
      cliente.unaFoto(carpetaId),
    ]);
    const fotosPublicas = foto !== null && (await cliente.fotoEsPublica(foto));
    return [
      `Google respondió: "${sheet.nombre}" y "${carpeta.nombre}".`,
      fotosPublicas ? "Las fotos se ven sin credenciales." : "Las fotos no se ven sin credenciales.",
      sheet.puedeEditar || carpeta.puedeEditar ? "Ojo: la cuenta puede editar, y tendría que ser solo lectora." : "",
    ]
      .filter(Boolean)
      .join(" ");
  },
};

/** "Probar conexión": lo que falla por motivos esperables vuelve como resultado, con su mensaje. */
export async function probarConexion(integracion: IntegracionConCredencial): Promise<PruebaConexion> {
  const inicio = performance.now();
  const latenciaMs = () => Math.round(performance.now() - inicio);
  try {
    const mensaje = await PRUEBAS[integracion]();
    return { ok: true, latenciaMs: latenciaMs(), mensaje };
  } catch (error) {
    if (!isAppError(error)) throw error;
    return { ok: false, latenciaMs: latenciaMs(), mensaje: error.message };
  }
}
