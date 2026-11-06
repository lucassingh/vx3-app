import "server-only";
import { serverEnv } from "@/env";
import { ExternalServiceError } from "@/lib/errors";
import { limiteCompartido } from "@/lib/rate-limit";
import { leerCredencial } from "@/modules/platform/credentials/service";
import { createTiendaNubeClient, createTiendaNubeEscritura, LIMITE_DE_TIENDA_NUBE } from "./client";

type Opciones = Partial<Omit<Parameters<typeof createTiendaNubeClient>[1], "limite">>;

async function datosDeConexion() {
  const { TIENDANUBE_STORE_ID: storeId } = serverEnv();
  if (!storeId) throw new ExternalServiceError("Tienda Nube", "Falta TIENDANUBE_STORE_ID en este ambiente.");
  const token = await leerCredencial("tiendanube");
  if (!token) throw new ExternalServiceError("Tienda Nube", "Todavía no se cargó el token de Tienda Nube.");
  return { storeId, token };
}

const limite = () => limiteCompartido(LIMITE_DE_TIENDA_NUBE.clave, LIMITE_DE_TIENDA_NUBE.intervaloMs);

/** Para leer, en cualquier ambiente. */
export async function tiendaNube(opciones: Opciones = {}) {
  return createTiendaNubeClient(await datosDeConexion(), { ...opciones, limite: limite() });
}

/** Lo único que escribe en la tienda. Fuera de producción falla. */
export async function tiendaNubeEscritura(opciones: Opciones = {}) {
  return createTiendaNubeEscritura(await datosDeConexion(), {
    ...opciones,
    ambiente: process.env.APP_ENV,
    limite: limite(),
  });
}
