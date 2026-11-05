import "server-only";
import { getDb } from "@/db/client";
import type { SyncRunStatus } from "@/generated/prisma/client";
import type { Integracion } from "@/lib/api/types";
import { businessTime } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { credencialEnmascarada } from "../credentials/service";
import { hayCorridaEnCurso } from "../sync-runs";
import { estadoDeDux, frecuenciaDeDux, LECTURAS_DUX, type UltimaCorrida } from "./estado";

/**
 * Panel de integraciones (RF-M0-04): lo que muestra sale de las corridas reales. Lo que
 * todavía no está conectado no tiene nada para mostrar, y lo dice.
 */

type Pendiente = Pick<Integracion, "id" | "nombre" | "tipo" | "detalle">;

/** En el orden en que se conectan (`solucion_doc/07`). Cada una sale de acá con la PR que la conecta. */
const PENDIENTES: Pendiente[] = [
  {
    id: "tiendanube",
    nombre: "Tienda Nube",
    tipo: "App de VX3",
    detalle: "Publicación de productos y precios. Se conecta en la PR 1.9.",
  },
  {
    id: "meta",
    nombre: "Meta Ads",
    tipo: "Marketing API",
    detalle: "Gasto y resultados por anuncio, para medir la pauta. Se conecta en la PR 1.6.",
  },
  {
    id: "zupply",
    nombre: "Zupply · Transtech",
    tipo: "Mensajería AMBA",
    detalle: "Se importa el export, para la rendición de la contraentrega. Entra en la PR 1.7.",
  },
  {
    id: "santander",
    nombre: "Santander",
    tipo: "Extracto bancario",
    detalle: "Se importa el extracto, para la rendición de la contraentrega. Entra en la PR 1.7.",
  },
  {
    id: "supervielle",
    nombre: "Supervielle",
    tipo: "Extracto bancario",
    detalle: "Se importa el extracto, para la rendición de la contraentrega. Entra en la PR 1.7.",
  },
  {
    id: "provincia",
    nombre: "Provincia",
    tipo: "Extracto bancario",
    detalle: "Se importa el extracto, para la rendición de la contraentrega. Entra en la PR 1.7.",
  },
  {
    id: "nacion",
    nombre: "Nación",
    tipo: "Extracto bancario",
    detalle: "Se importa el extracto, para la rendición de la contraentrega. Entra en la PR 1.7.",
  },
  {
    id: "correo",
    nombre: "MiCorreo",
    tipo: "Correo Argentino · cotizador",
    detalle: "Cotización de envíos, bulto por bulto. Se conecta en la PR 2.1.",
  },
  {
    id: "whatsapp",
    nombre: "WhatsApp Cloud API",
    tipo: "Mensajería · webhook",
    detalle: "Los mensajes de la bandeja, por la API oficial. Se conecta en la PR 2.2.",
  },
  {
    id: "anthropic",
    nombre: "Anthropic · Claude",
    tipo: "IA del bot",
    detalle: "Las respuestas del bot. Se conecta en la PR 2.4.",
  },
];

const aPendiente = (pendiente: Pendiente): Integracion => ({
  ...pendiente,
  estado: "pendiente",
  frecuencia: "—",
  ultimoSync: null,
  metricas: [],
  credencial: null,
});

async function integracionDux(): Promise<Integracion> {
  const db = getDb();
  const dux = { integration: "dux" };
  const [credencial, corridas, sincronizando, productos, comprobantes, clientas, deHoy] = await Promise.all([
    credencialEnmascarada("dux"),
    // Cada sincronización escribe las tres: entre las últimas 30 están las más nuevas de cada una.
    db.syncRun.findMany({
      where: { ...dux, operation: { in: Object.keys(LECTURAS_DUX) }, status: { not: "en_curso" } },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
    hayCorridaEnCurso("dux"),
    db.duxItem.count({ where: { present: true } }),
    db.duxInvoice.count(),
    db.duxCustomer.count(),
    db.syncRun.aggregate({
      where: { ...dux, startedAt: { gte: businessTime.startOfDay(businessTime.today()) } },
      _sum: { calls: true },
    }),
  ]);

  const ultimas: UltimaCorrida[] = [];
  for (const corrida of corridas) {
    if (corrida.status === "en_curso" || ultimas.some((u) => u.operation === corrida.operation)) continue;
    ultimas.push({ ...corrida, status: corrida.status });
  }
  const { estado, motivo } = estadoDeDux({ tieneCredencial: Boolean(credencial), ultimas, ahora: new Date() });
  const terminadas = ultimas.filter(({ status }) => status !== "error").map(({ finishedAt }) => finishedAt);
  const ultimoSync = terminadas.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null);

  return {
    id: "dux",
    nombre: "DUX",
    tipo: "ERP · API v1 y v2",
    estado,
    detalle: sincronizando ? `Hay una sincronización en curso. ${motivo}` : motivo,
    frecuencia: frecuenciaDeDux(),
    ultimoSync: ultimoSync?.toISOString() ?? null,
    metricas: [
      { label: "Productos", value: formatNumber(productos) },
      { label: "Comprobantes", value: formatNumber(comprobantes) },
      { label: "Clientas", value: formatNumber(clientas) },
      { label: "Llamadas hoy", value: formatNumber(deHoy._sum.calls ?? 0) },
    ],
    credencial,
    sincronizando,
  };
}

export async function listarIntegraciones(): Promise<Integracion[]> {
  return [await integracionDux(), ...PENDIENTES.map(aPendiente)];
}

export type FilaDelRegistro = {
  id: string;
  integracion: string;
  operacion: string;
  /** Quién la lanzó: una persona, o "automática" si fue el cron. */
  origen: string;
  resultado: SyncRunStatus;
  detalle: string | null;
  /** null si todavía está corriendo. */
  duracionMs: number | null;
  /** Fecha y hora ISO. */
  en: string;
};

/** "ventas_historial:2026-10:1" es el mes de octubre de la sucursal 1. */
function nombreDeOperacion(operacion: string): string {
  const [, mes, sucursal] = /^ventas_historial:(.+):(.+)$/.exec(operacion) ?? [];
  if (mes && sucursal) return `Historial de ventas · ${mes} · sucursal ${sucursal}`;
  if (operacion === "fichas") return "Fichas de clientas";
  return LECTURAS_DUX[operacion] ?? operacion;
}

export async function registroDeSincronizaciones(limite = 20): Promise<FilaDelRegistro[]> {
  const corridas = await getDb().syncRun.findMany({ orderBy: { startedAt: "desc" }, take: limite });
  return corridas.map((corrida) => ({
    id: corrida.id,
    integracion: corrida.integration === "dux" ? "DUX" : corrida.integration,
    operacion: nombreDeOperacion(corrida.operation),
    origen: corrida.trigger === "cron" ? "automática" : (corrida.triggeredBy ?? "manual"),
    resultado: corrida.status,
    detalle: corrida.detail,
    duracionMs: corrida.finishedAt ? corrida.finishedAt.getTime() - corrida.startedAt.getTime() : null,
    en: corrida.startedAt.toISOString(),
  }));
}
