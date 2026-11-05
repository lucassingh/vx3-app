/**
 * Integraciones que guardan una credencial en la app. Cada una se suma acá con
 * la PR que la conecta.
 */
export const INTEGRACIONES_CON_CREDENCIAL = ["dux", "google"] as const;

export type IntegracionConCredencial = (typeof INTEGRACIONES_CON_CREDENCIAL)[number];

export const NOMBRE_INTEGRACION: Record<IntegracionConCredencial, string> = { dux: "DUX", google: "Google" };

export function usaCredencial(id: string): id is IntegracionConCredencial {
  return (INTEGRACIONES_CON_CREDENCIAL as readonly string[]).includes(id);
}
