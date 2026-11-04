"use server";

import { z } from "zod";
import { defineAction } from "@/lib/action";
import { INTEGRACIONES_CON_CREDENCIAL, NOMBRE_INTEGRACION } from "./integraciones";
import { guardarCredencial } from "./service";

/** Carga o reemplaza la credencial de una integración: solo admin (plataforma.editar). */
export const cargarCredencial = defineAction({
  name: "credenciales.cargar",
  input: z.object({
    integracion: z.enum(INTEGRACIONES_CON_CREDENCIAL, "Integración desconocida."),
    valor: z.string().trim().min(8, "Parece incompleta: revisá que la hayas copiado entera.").max(4096),
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
