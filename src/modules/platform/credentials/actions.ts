"use server";

import { z } from "zod";
import { defineAction } from "@/lib/action";
import { leerCuentaDeServicio } from "@/integrations/google/cuenta";
import { ConflictError } from "@/lib/errors";
import { arrancarSincronizacionDux } from "@/workflows/arrancar-dux";
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

/** Lanza la sincronización y no espera a que termine: solo admin. */
export const sincronizarIntegracion = defineAction({
  name: "integraciones.sincronizar",
  input: z.object({ integracion: z.literal("dux") }),
  permission: "plataforma.editar",
  handler: async (_input, { user, log }) => {
    const resultado = await arrancarSincronizacionDux({ trigger: "manual", triggeredBy: user.name });
    if (!resultado.arrancada) throw new ConflictError("Ya hay una sincronización en curso: esperá a que termine.");
    log.info({ runId: resultado.runId }, "sincronización manual");
    return { runId: resultado.runId };
  },
});
