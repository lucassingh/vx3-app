import { z } from "zod";

/** La clave de una cuenta de servicio: el JSON que da Google, con lo que la app usa de él. */
const cuentaDeServicioSchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
  token_uri: z.url(),
});

export type CuentaDeServicio = z.output<typeof cuentaDeServicioSchema>;

/** Null si lo pegado no es ese JSON. */
export function leerCuentaDeServicio(valor: string): CuentaDeServicio | null {
  try {
    return cuentaDeServicioSchema.parse(JSON.parse(valor));
  } catch {
    return null;
  }
}
