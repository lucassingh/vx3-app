/**
 * El teléfono es la identidad de la clienta (RN-90): con o sin 54, con o sin 9, con
 * guiones o sin ellos, son los últimos 10 dígitos. Con menos de 10 no identifica a nadie.
 */
export function telefonoNormalizado(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  return digitos.length >= 10 ? digitos.slice(-10) : null;
}
