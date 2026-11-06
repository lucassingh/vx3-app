"use server";

import { z } from "zod";
import { defineAction } from "@/lib/action";
import { borrarBorrador, borrarFotosSinUso, guardarBorrador } from "./alta-consultas";
import { CLAVE_DE_FOTO, FOTOS_POR_PRODUCTO } from "./fotos";
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

/* ---- Borradores del alta ---- */

const entradaDeAlta = z.object({
  sku: z.string().max(64),
  rubro: z.string().max(120),
  subrubro: z.string().max(120),
  nombre: z.string().max(250),
  prenda: z.string().max(200),
  color: z.string().max(120),
  copa: z.string().max(40),
  marca: z.string().max(120),
  proveedorId: z.string().max(40),
  tela: z.string().max(200),
  colores: z.array(z.string().max(80)).max(60),
  talles: z.string().max(120),
  atributos: z.record(z.string().max(40), z.string().max(200)),
  opcionales: z.object({
    tres: z.boolean().optional(),
    docena: z.boolean().optional(),
    dosDocenas: z.boolean().optional(),
  }),
  costoDocena: z.number().min(0),
  pesoBultoKg: z.number().min(0),
  medidasCm: z.tuple([z.number().min(0), z.number().min(0), z.number().min(0)]),
  fotos: z
    .array(
      z.object({
        clave: z.string().regex(CLAVE_DE_FOTO).max(300),
        nombre: z.string().max(250),
        ancho: z.number().int().min(0).nullable(),
        alto: z.number().int().min(0).nullable(),
      }),
    )
    .max(FOTOS_POR_PRODUCTO),
});

/** Sin `id`, crea uno. Sin validar: guarda lo que todavía no está completo. */
export const guardarBorradorDeAlta = defineAction({
  name: "catalogo.guardarBorrador",
  input: z.object({ id: z.uuid().nullable(), input: entradaDeAlta }),
  permission: "catalogo.editar",
  handler: async ({ id, input }, { user }) => {
    return guardarBorrador(id, input, { id: user.id, label: user.name });
  },
});

export const borrarBorradorDeAlta = defineAction({
  name: "catalogo.borrarBorrador",
  input: z.object({ id: z.uuid() }),
  permission: "catalogo.editar",
  handler: async ({ id }) => {
    await borrarBorrador(id);
    return { borrado: true };
  },
});

/** Una foto que se quitó del formulario. Si sigue en un borrador guardado, se borra al guardarlo sin ella. */
export const descartarFotosSubidas = defineAction({
  name: "catalogo.descartarFotos",
  input: z.object({ claves: z.array(z.string().regex(CLAVE_DE_FOTO).max(300)).min(1).max(FOTOS_POR_PRODUCTO) }),
  permission: "catalogo.editar",
  handler: async ({ claves }) => {
    await borrarFotosSinUso(claves);
    return { descartadas: claves.length };
  },
});
