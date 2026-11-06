"use server";

import { z } from "zod";
import { defineAction } from "@/lib/action";
import {
  confirmarHistoricosPendientes,
  decidirFoto,
  deshacerDecision,
  deshacerHistoricosConfirmados,
  marcarNoHistorico,
} from "./decisiones";
import { DECISION_DE_FOTO, DECISION_DE_HISTORICO } from "./importar";

const codigo = z.string().trim().min(1, "Falta el código.").max(64);

/** A qué producto va una foto suelta; `producto` null la descarta. */
export const decidirFotoSuelta = defineAction({
  name: "catalogo.foto",
  input: z.object({ driveId: z.string().min(1).max(128), producto: codigo.nullable() }),
  permission: "catalogo.editar",
  handler: async ({ driveId, producto }, { user, audit }) => {
    const resultado = await decidirFoto(driveId, producto, { id: user.id, label: user.name });
    await audit({
      action: "catalogo.foto",
      entityType: "foto",
      entityId: driveId,
      after: { archivo: resultado.archivo, producto: resultado.producto },
    });
    return { aplicada: resultado.aplicada };
  },
});

/** Una excepción antes de confirmar en bloque: queda agotado, y se sigue viendo en el catálogo. */
export const noEsHistorico = defineAction({
  name: "catalogo.noEsHistorico",
  input: z.object({ producto: codigo }),
  permission: "catalogo.editar",
  handler: async ({ producto }, { user, audit }) => {
    const resultado = await marcarNoHistorico(producto, { id: user.id, label: user.name });
    await audit({
      action: "catalogo.no_historico",
      entityType: "producto",
      entityId: resultado.producto,
      after: { historico: false },
    });
    return { aplicada: resultado.aplicada };
  },
});

export const confirmarHistoricos = defineAction({
  name: "catalogo.confirmarHistoricos",
  input: z.object({}),
  permission: "catalogo.editar",
  handler: async (_input, { user, audit }) => {
    const resultado = await confirmarHistoricosPendientes({ id: user.id, label: user.name });
    await audit({
      action: "catalogo.historicos",
      entityType: "catalogo",
      after: { confirmados: resultado.confirmados },
    });
    return resultado;
  },
});

/** Sin `clave`, deshace la confirmación en bloque de los históricos. */
export const deshacerDecisionDelCatalogo = defineAction({
  name: "catalogo.deshacer",
  input: z.object({
    tipo: z.enum([DECISION_DE_FOTO, DECISION_DE_HISTORICO]),
    clave: z.string().min(1).max(128).nullable(),
  }),
  permission: "catalogo.editar",
  handler: async ({ tipo, clave }, { audit }) => {
    const resultado = clave === null ? await deshacerHistoricosConfirmados() : await deshacerDecision(tipo, clave);
    await audit({
      action: "catalogo.deshacer",
      entityType: tipo,
      entityId: clave,
      after: { deshecha: true },
    });
    return { aplicada: resultado.aplicada };
  },
});
