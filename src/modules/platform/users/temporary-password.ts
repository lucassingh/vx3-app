/**
 * Contraseña temporal para un usuario nuevo o reseteado: 16 caracteres al azar
 * en grupos de 4 ("k7Pm-x2Qa-…"), sin los que se confunden al dictarlos
 * (0/O, 1/l/I). Se muestra una sola vez y el usuario la cambia al entrar.
 */

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // 256 no es múltiplo de 57: se descartan los bytes que sesgarían el reparto.
  const limit = 256 - (256 % ALPHABET.length);
  const chars: string[] = [];
  let index = 0;
  let pool = bytes;
  while (chars.length < 16) {
    if (index >= pool.length) {
      pool = crypto.getRandomValues(new Uint8Array(16));
      index = 0;
    }
    const byte = pool[index++] ?? 0;
    if (byte < limit) chars.push(ALPHABET[byte % ALPHABET.length] ?? "");
  }
  return chars.join("").replace(/(.{4})(?!$)/g, "$1-");
}
