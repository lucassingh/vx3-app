import { clientEnv } from "@/env";
/**
 * Interruptor único entre la API simulada (src/mocks) y el backend real.
 *
 *   NEXT_PUBLIC_API_MOCK=true    API simulada (default): en proceso en el servidor
 *                                y en /api/mock para el navegador.
 *   NEXT_PUBLIC_API_MOCK=false   API real: API_URL (servidor) y
 *                                NEXT_PUBLIC_API_URL (navegador).
 *
 * Se valida con el resto de las variables en src/env.ts.
 *
 * Lleva el prefijo NEXT_PUBLIC_ porque la leen el servidor y el navegador, y
 * Next la fija al compilar: después de cambiarla hay que reiniciar `npm run dev`.
 */
export function isMockApi() {
  return clientEnv().NEXT_PUBLIC_API_MOCK;
}
