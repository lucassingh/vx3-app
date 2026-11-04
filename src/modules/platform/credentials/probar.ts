import "server-only";
import { duxClient } from "@/integrations/dux";
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
