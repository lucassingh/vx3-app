"use server";

import { z } from "zod";
import { defineAction } from "@/lib/action";
import { leerCuentaDeServicio } from "@/integrations/google/cuenta";
import { ConflictError } from "@/lib/errors";
import { arrancarImportacionDelCatalogo } from "@/workflows/arrancar-catalogo";
import { arrancarSincronizacionDux } from "@/workflows/arrancar-dux";
import { leerTiendaNube } from "@/workflows/tienda";
import { INTEGRACIONES_CON_CREDENCIAL, NOMBRE_INTEGRACION } from "./integraciones";
import { probarConexion } from "./probar";
import { guardarCredencial } from "./service";

const integracion = z.enum(INTEGRACIONES_CON_CREDENCIAL, "Integración desconocida.");

/** Carga o reemplaza la credencial de una integración: solo admin (plataforma.editar). */
export const cargarCredencial = defineAction({
  name: "credenciales.cargar",
  input: z
    .object({
      integracion,
      valor: z.string().trim().min(8, "Parece incompleta: revisá que la hayas copiado entera.").max(4096),
    })
    .refine(({ integracion, valor }) => integracion !== "google" || leerCuentaDeServicio(valor) !== null, {
      path: ["valor"],
      message: "No es la clave de una cuenta de servicio: pegá el archivo JSON entero.",
    }),
  permission: "plataforma.editar",
  handler: async ({ integracion, valor }, { user, audit }) => {
    const { mascara, anterior } = await guardarCredencial(integracion, valor, { id: user.id, label: user.name });
    await audit({
      action: "credencial.cargada",
      entityType: "integracion",
      entityId: integracion,
      before: anterior ? { mascara: anterior } : null,
      after: { integracion: NOMBRE_INTEGRACION[integracion], mascara },
    });
    return { mascara };
  },
});

/** Prueba la conexión con la credencial guardada: solo admin. */
export const probarIntegracion = defineAction({
  name: "credenciales.probar",
  input: z.object({ integracion }),
  permission: "plataforma.editar",
  handler: async ({ integracion: id }, { log }) => {
    const resultado = await probarConexion(id);
    log.info({ integracion: id, ok: resultado.ok, latenciaMs: resultado.latenciaMs }, "prueba de conexión");
    return resultado;
  },
});

/** Lanza la lectura de esa integración y no espera a que termine: solo admin. */
export const sincronizarIntegracion = defineAction({
  name: "integraciones.sincronizar",
  input: z.object({ integracion }),
  permission: "plataforma.editar",
  handler: async ({ integracion: id }, { user, log }) => {
    const origen = { trigger: "manual" as const, triggeredBy: user.name };
    // Son unos 8 pedidos: se hace acá mismo, sin lanzar un workflow.
    if (id === "tiendanube") {
      const { status } = await leerTiendaNube(origen);
      log.info({ integracion: id, status }, "lectura manual");
      return { runId: null };
    }
    const resultado =
      id === "google" ? await arrancarImportacionDelCatalogo(origen) : await arrancarSincronizacionDux(origen);
    if (!resultado.arrancada) {
      throw new ConflictError(
        id === "google"
          ? "Ya hay una importación en curso: esperá a que termine."
          : "Ya hay una sincronización en curso: esperá a que termine.",
      );
    }
    log.info({ integracion: id, runId: resultado.runId }, "lectura manual");
    return { runId: resultado.runId };
  },
});
