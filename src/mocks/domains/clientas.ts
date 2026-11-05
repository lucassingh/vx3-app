import type {
  ClientaFila,
  ClientasCobertura,
  DuplicadoClienta,
  FichaClienta,
  FichaEvento,
  IdentidadSistema,
  ListaDeRecompra,
  RecompraEstado,
  RecompraResultados,
  Segmento,
  SegmentoResumen,
} from "@/lib/api/types";
import { businessTime } from "@/lib/dates";
import { BANCO, TRANSPORTE } from "@/lib/domain";
import { primerNombre } from "@/lib/format";
import {
  armarMensaje,
  ETAPA_LABEL,
  etapaQueToca,
  productoEnMensaje,
  umbralAltoValor,
  VALORES_DE_RECOMPRA,
  type Etapa,
} from "@/modules/customers/secuencia";
import { normalizeText } from "@/lib/utils";
import { defineStore } from "../db";
import { errorResponse, paginate, readJson, type Route } from "../http";
import {
  clientas,
  DAY,
  detalleDe,
  getAnuncio,
  getClienta,
  getProducto,
  HOUR,
  isoAgo,
  pedidos,
  type ClientaSeed,
  type PedidoSeed,
} from "../seed";

/** M12 · Clientes y recompra. Todo se cruza por el teléfono normalizado (RN-90). */

const SEGMENTOS: Segmento[] = ["nueva", "activa", "top", "en_riesgo", "dormida"];

/** RN-90: sacar el 54, sacar el 9 y quedarse con los últimos 10 dígitos. */
export function normalizarTelefono(telefono: string) {
  let digits = telefono.replace(/\D/g, "");
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9")) digits = digits.slice(1);
  return digits.slice(-10);
}

/** Margen histórico estimado: ~22,5 % de lo comprado (mezcla de bultos de lencería y medias). */
function margenDe(clienta: ClientaSeed) {
  return Math.round((clienta.totalComprado * 0.225) / 100) * 100;
}

function origenLabel(clienta: ClientaSeed) {
  switch (clienta.origen) {
    case "anuncio":
      return clienta.anuncioOrigenId ? getAnuncio(clienta.anuncioOrigenId).nombre : "Anuncio";
    case "organico":
      return "Orgánico";
    case "local":
      return "Local";
    case "tiendanube":
      return "Tienda Nube";
  }
}

function toFila(clienta: ClientaSeed): ClientaFila {
  return {
    id: clienta.id,
    nombre: clienta.nombre,
    telefono: clienta.telefono,
    localidad: clienta.localidad,
    provincia: clienta.provincia,
    zona: clienta.zona,
    segmento: clienta.segmento,
    origen: clienta.origen,
    origenLabel: origenLabel(clienta),
    pedidos: clienta.pedidos,
    totalComprado: clienta.totalComprado,
    margen: margenDe(clienta),
    ultimaCompraDias: clienta.ultimaCompraDias,
    cicloDias: clienta.cicloDias,
  };
}

const pedidosDe = (clientaId: string) =>
  pedidos.filter((pedido) => pedido.clientaId === clientaId).toSorted((a, b) => a.creadoHaceMin - b.creadoHaceMin);

/** Estados en los que el pedido ya es una compra firme. */
const COMPRADO = new Set(["listo_facturar", "facturado", "en_armado", "despachado", "entregado", "cobrado", "rendido"]);

/** Lo que suele comprar cuando no hay pedidos recientes en la semilla. */
const FAVORITOS: Record<string, string[]> = {
  "c-10": ["CAN9", "VN16", "LN35"],
  "c-16": ["BCN2", "CJATN31"],
  "c-20": ["PVM3", "LN35", "BMN1"],
};

function skusFrecuentes(clienta: ClientaSeed) {
  const counts = new Map<string, number>();
  for (const pedido of pedidosDe(clienta.id)) {
    if (pedido.estado === "anulado") continue;
    for (const item of pedido.items) counts.set(item.sku, (counts.get(item.sku) ?? 0) + 1);
  }
  if (counts.size === 0) for (const sku of FAVORITOS[clienta.id] ?? []) counts.set(sku, 1);

  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([sku, veces]) => {
      const producto = getProducto(sku);
      return { sku, nombre: producto.nombre, colores: producto.colores, veces };
    });
}

/* ---- Ficha única ----------------------------------------------------------- */

/** Reclamos abiertos o resueltos que figuran en post-venta. */
const RECLAMOS: Record<string, { pedidoId: string; haceMin: number; titulo: string; detalle: string }[]> = {
  "c-11": [
    {
      pedidoId: "V-1042",
      haceMin: 22 * HOUR,
      titulo: "Reclamo tipo 1 · falta mercadería",
      detalle: "Faltó media docena de LN35 en el V-1042. Mandó el video de apertura; el reintegro vence en 2 h.",
    },
  ],
  "c-04": [
    {
      pedidoId: "V-1033",
      haceMin: 8 * DAY,
      titulo: "Reclamo tipo 3 · producto equivocado",
      detalle: "Le llegó otro color del CJATN2. Se lo quedó: la diferencia era menor a $ 5.000 (RN-56).",
    },
  ],
};

function eventosDePedido(pedido: PedidoSeed, now: number): FichaEvento[] {
  const detalle = detalleDe(pedido);
  const bultos = detalle.lineas.reduce((sum, linea) => sum + linea.bultos, 0);
  const eventos: FichaEvento[] = [];

  if (pedido.canal === "whatsapp" || pedido.canal === "vidriera") {
    const titulo =
      pedido.origen === "anuncio" && pedido.anuncioId
        ? `Escribió desde el anuncio “${getAnuncio(pedido.anuncioId).nombre}”`
        : pedido.origen === "recompra"
          ? "Volvió a escribir sin un clic nuevo (recompra)"
          : "Escribió por WhatsApp";
    eventos.push({
      id: `${pedido.id}-conv`,
      tipo: "conversacion",
      titulo,
      detalle:
        pedido.canal === "vidriera"
          ? "Armó el carrito en la vidriera y mandó el pedido por WhatsApp."
          : "El bot le respondió con el producto, la foto y el stock real.",
      fecha: isoAgo(pedido.creadoHaceMin + 20, now),
      canal: "whatsapp",
    });
  }

  eventos.push({
    id: `${pedido.id}-pedido`,
    tipo: "pedido",
    titulo: `Pedido ${pedido.id}`,
    detalle: `${detalle.lineas.length} ${detalle.lineas.length === 1 ? "producto" : "productos"} · ${bultos} ${bultos === 1 ? "bulto" : "bultos"} · ${TRANSPORTE[pedido.transporte]}${pedido.nota ? `. ${pedido.nota}` : ""}`,
    fecha: isoAgo(pedido.creadoHaceMin, now),
    monto: detalle.total,
    estado: pedido.estado,
    canal: pedido.canal,
  });

  if (COMPRADO.has(pedido.estado) && pedido.pago !== "contraentrega") {
    const cobro =
      pedido.pago === "transferencia"
        ? `Transferencia ${pedido.banco ? `de ${BANCO[pedido.banco]} ` : ""}conciliada e imputada en DUX`
        : pedido.pago === "efectivo"
          ? "Pagó en efectivo en el local"
          : "Pagó con tarjeta en Tienda Nube";
    eventos.push({
      id: `${pedido.id}-cobro`,
      tipo: "cobro",
      titulo: cobro,
      detalle: pedido.factura ? `Comprobante ${pedido.factura}` : "Sin comprobante todavía",
      fecha: isoAgo(Math.max(5, pedido.creadoHaceMin - 30), now),
      monto: detalle.total,
    });
  }

  if (["despachado", "entregado", "cobrado", "rendido", "devuelto"].includes(pedido.estado)) {
    const entregado = pedido.estado !== "despachado";
    eventos.push({
      id: `${pedido.id}-envio`,
      tipo: "envio",
      titulo:
        pedido.estado === "devuelto"
          ? "Paquete devuelto al local"
          : `${entregado ? "Entregado" : "Despachado"} por ${TRANSPORTE[pedido.transporte]}`,
      detalle: pedido.estado === "devuelto" && pedido.nota ? pedido.nota : `Pedido ${pedido.id}`,
      fecha: isoAgo(Math.max(5, Math.round(pedido.creadoHaceMin * 0.5)), now),
    });
  }

  if (pedido.pago === "contraentrega" && (pedido.estado === "cobrado" || pedido.estado === "rendido")) {
    eventos.push({
      id: `${pedido.id}-rendicion`,
      tipo: "cobro",
      titulo:
        pedido.estado === "rendido" ? "Contraentrega rendida por Transtech" : "Transtech cobró: falta la rendición",
      detalle: `Pedido ${pedido.id}`,
      fecha: isoAgo(Math.max(5, Math.round(pedido.creadoHaceMin * 0.3)), now),
      monto: detalle.total,
    });
  }

  return eventos;
}

function identidades(clienta: ClientaSeed, normalizado: string): IdentidadSistema[] {
  const propios = pedidosDe(clienta.id);
  const list: IdentidadSistema[] = [
    { sistema: "WhatsApp", valor: clienta.telefono, detalle: "Conversaciones de ventas y del local" },
    { sistema: "DUX", valor: `0${normalizado}`, detalle: `Cliente en DUX · ${clienta.pedidos} comprobantes` },
  ];
  if (clienta.origen === "tiendanube" || propios.some((pedido) => pedido.canal === "tiendanube")) {
    list.push({ sistema: "Tienda Nube", valor: `+54 ${normalizado}`, detalle: "Cuenta de la tienda online" });
  }
  if (clienta.origen === "local" || propios.some((pedido) => pedido.canal === "local")) {
    list.push({ sistema: "Local", valor: normalizado, detalle: "Ventas del salón, antes como consumidor final" });
  }
  return list;
}

function ficha(clienta: ClientaSeed, now: number): FichaClienta {
  const normalizado = normalizarTelefono(clienta.telefono);
  const eventos = [
    ...pedidosDe(clienta.id).flatMap((pedido) => eventosDePedido(pedido, now)),
    ...(RECLAMOS[clienta.id] ?? []).map((reclamo, index) => ({
      id: `${clienta.id}-reclamo-${index}`,
      tipo: "reclamo" as const,
      titulo: reclamo.titulo,
      detalle: reclamo.detalle,
      fecha: isoAgo(reclamo.haceMin, now),
    })),
    {
      id: `${clienta.id}-primera`,
      tipo: "pedido" as const,
      titulo: "Primera compra",
      detalle: `Entró por ${clienta.origen === "anuncio" ? `el anuncio “${origenLabel(clienta)}”` : origenLabel(clienta).toLowerCase()}.`,
      fecha: isoAgo(clienta.primeraCompraDias * DAY + 3 * HOUR, now),
    },
  ].toSorted((a, b) => b.fecha.localeCompare(a.fecha));

  const anuncio = clienta.anuncioOrigenId ? getAnuncio(clienta.anuncioOrigenId) : null;

  return {
    ...toFila(clienta),
    cp: clienta.cp,
    primeraCompraDias: clienta.primeraCompraDias,
    ticketPromedio: Math.round(clienta.totalComprado / Math.max(1, clienta.pedidos) / 100) * 100,
    telefonoNormalizado: normalizado,
    identidades: identidades(clienta, normalizado),
    anuncioOrigen: anuncio
      ? { id: anuncio.id, nombre: anuncio.nombre, campana: anuncio.campana, sku: anuncio.sku }
      : null,
    skusFrecuentes: skusFrecuentes(clienta),
    eventos,
  };
}

/* ---- Duplicados -------------------------------------------------------------- */

const getDuplicados = defineStore("clientas-duplicados", (): DuplicadoClienta[] => [
  {
    id: "dup-1",
    clientaId: "c-13",
    nombre: "Mariela Godoy",
    telefonoNormalizado: normalizarTelefono(getClienta("c-13").telefono),
    motivo: "Mismo teléfono en DUX como consumidor final",
    registros: [
      { sistema: "App", nombre: "Mariela Godoy", detalle: "31 pedidos · WhatsApp y local" },
      { sistema: "DUX", nombre: "Consumidor final", detalle: "8 ventas del local con el teléfono 1130218876" },
    ],
  },
  {
    id: "dup-2",
    clientaId: "c-08",
    nombre: "Florencia Aguirre",
    telefonoNormalizado: normalizarTelefono(getClienta("c-08").telefono),
    motivo: "En Tienda Nube figura con otro nombre",
    registros: [
      { sistema: "App", nombre: "Florencia Aguirre", detalle: "5 pedidos · Mendoza" },
      { sistema: "Tienda Nube", nombre: "Flor Aguirre Lencería", detalle: "2 órdenes con el teléfono +54 2614550918" },
    ],
  },
  {
    id: "dup-3",
    clientaId: "c-04",
    nombre: "Johana Quiroga",
    telefonoNormalizado: normalizarTelefono(getClienta("c-04").telefono),
    motivo: "Dos clientes en DUX con el mismo número escrito distinto",
    registros: [
      { sistema: "DUX", nombre: "Johana Quiroga", detalle: "Teléfono 011 3398-7712 · 17 comprobantes" },
      { sistema: "DUX", nombre: "Johanna Quiroga", detalle: "Teléfono 5491133987712 · 5 comprobantes" },
    ],
  },
]);

/* ---- Recompra del día ------------------------------------------------------- */

/** Las que ya figuran como contactadas hoy al arrancar la demo. */
const YA_CONTACTADAS = new Set(["c-10", "c-16"]);

function crearRecompra(): ListaDeRecompra {
  const hoy = businessTime.today();
  const enSecuencia = (clienta: ClientaSeed) => ({
    ultimaCompra: businessTime.addDays(hoy, -clienta.ultimaCompraDias),
    compras: clienta.pedidos,
    cicloDias: clienta.cicloDias,
    margen12mCentavos: margenDe(clienta) * 100,
  });
  const umbral = umbralAltoValor(
    clientas.filter(({ segmento }) => segmento === "dormida").map((clienta) => margenDe(clienta) * 100),
  );
  const elegidas = clientas
    .map((clienta) => ({ clienta, etapa: etapaQueToca(enSecuencia(clienta), [], umbral, hoy) }))
    .filter((item): item is { clienta: ClientaSeed; etapa: Etapa } => item.etapa !== null)
    .toSorted((a, b) => margenDe(b.clienta) - margenDe(a.clienta));

  return {
    hoy: elegidas.slice(0, VALORES_DE_RECOMPRA.contactosPorDia).map(({ clienta, etapa }) => {
      const propios = pedidosDe(clienta.id);
      const compra = propios.find((pedido) => COMPRADO.has(pedido.estado));
      const skus = skusFrecuentes(clienta);
      const producto = skus[0] ? productoEnMensaje(skus[0].nombre) : null;
      const { texto } = armarMensaje(
        etapa,
        {
          nombre: primerNombre(clienta.nombre),
          categorias: ["medias", "corpiños", "conjuntos de lencería"],
          productoNuevo: producto,
          comboNuevo: "lencería",
          productoPorAgotarse: producto,
        },
        clienta.id,
      );
      return {
        id: clienta.id,
        nombre: clienta.nombre,
        telefono: clienta.telefono,
        telefonoWa: clienta.telefono.replace(/\D/g, ""),
        segmento: clienta.segmento,
        tipo: etapa === "reactivacion" || etapa === "alto_valor" ? "reactivacion" : "recompra",
        etapa,
        etapaLabel: ETAPA_LABEL[etapa],
        motivo: `Hace ${clienta.ultimaCompraDias} días que compró`,
        ultimaCompraDias: clienta.ultimaCompraDias,
        cicloDias: clienta.cicloDias,
        totalComprado: clienta.totalComprado,
        ultimoPedido: compra
          ? {
              id: compra.id,
              total: detalleDe(compra).total,
              resumen: `${compra.items.length} productos · ${TRANSPORTE[compra.transporte]}`,
              haceDias: Math.floor(compra.creadoHaceMin / DAY),
            }
          : null,
        skus: skus.map(({ sku, nombre, colores }) => ({ sku, nombre, colores })),
        mensaje: texto,
        estado: YA_CONTACTADAS.has(clienta.id) ? "contactada" : "pendiente",
      };
    }),
    esperando: clientas
      .filter(({ segmento }) => segmento === "activa")
      .slice(0, 2)
      .map((clienta, index) => ({
        id: clienta.id,
        nombre: clienta.nombre,
        telefono: clienta.telefono,
        etapaLabel: ETAPA_LABEL.m1,
        contactadaHaceDias: index + 2,
        estado: "contactada",
      })),
    enCola: Math.max(0, elegidas.length - VALORES_DE_RECOMPRA.contactosPorDia),
    tope: VALORES_DE_RECOMPRA.contactosPorDia,
  };
}

const getRecompra = defineStore("clientas-recompra", crearRecompra);

const resultados: RecompraResultados = {
  contactadas: 38,
  compraron: 11,
  ventas: 812_000,
  margen: 186_000,
};

/* ---- Rutas ------------------------------------------------------------------ */

const ESTADOS_RECOMPRA: RecompraEstado[] = ["pendiente", "contactada", "respondio", "pospuesta"];

export const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/clientas$/,
    handler: ({ url }) => {
      const q = normalizeText(url.searchParams.get("q")?.trim() ?? "");
      const qDigits = q.replace(/\D/g, "");
      const segmento = url.searchParams.get("segmento") as Segmento | null;

      const rows = clientas
        .filter((clienta) => (segmento && SEGMENTOS.includes(segmento) ? clienta.segmento === segmento : true))
        .filter((clienta) => {
          if (!q) return true;
          const texto = normalizeText(`${clienta.nombre} ${clienta.localidad} ${clienta.provincia}`);
          const telefono = normalizarTelefono(clienta.telefono);
          return texto.includes(q) || (qDigits.length >= 3 && telefono.includes(qDigits));
        })
        .toSorted((a, b) => b.totalComprado - a.totalComprado)
        .map(toFila);

      return Response.json(paginate(rows, url, 8));
    },
  },
  {
    method: "GET",
    pattern: /^\/clientas\/segmentos$/,
    handler: () => {
      const total = clientas.reduce((sum, clienta) => sum + margenDe(clienta), 0);
      const resumen: SegmentoResumen[] = SEGMENTOS.map((segmento) => {
        const grupo = clientas.filter((clienta) => clienta.segmento === segmento);
        const margen = grupo.reduce((sum, clienta) => sum + margenDe(clienta), 0);
        return { segmento, clientas: grupo.length, margen, participacion: margen / total };
      });
      return Response.json(resumen);
    },
  },
  {
    method: "GET",
    pattern: /^\/clientas\/cobertura$/,
    handler: () => Response.json({ ventaIdentificada: 0.56, sinCompras: 0 } satisfies ClientasCobertura),
  },
  {
    method: "GET",
    pattern: /^\/clientas\/duplicados$/,
    handler: () => Response.json(getDuplicados()),
  },
  {
    method: "GET",
    pattern: /^\/clientas\/recompra$/,
    handler: () => Response.json(getRecompra()),
  },
  {
    method: "GET",
    pattern: /^\/clientas\/recompra\/resultados$/,
    handler: () => Response.json(resultados),
  },
  {
    method: "PATCH",
    pattern: /^\/clientas\/recompra\/([^/]+)$/,
    handler: async ({ params: [id], request }) => {
      const { hoy, esperando } = getRecompra();
      const item = hoy.find((entry) => entry.id === decodeURIComponent(id));
      const espera = esperando.find((entry) => entry.id === decodeURIComponent(id));
      if (!item && !espera) return errorResponse(404, `La clienta ${id} no está en la lista de hoy.`);
      const body = await readJson<{ estado: RecompraEstado; mensaje: string }>(request);
      if (!body.estado || !ESTADOS_RECOMPRA.includes(body.estado)) {
        return errorResponse(400, `Estado inválido: ${body.estado}.`);
      }
      if (item) {
        item.estado = body.estado;
        if (typeof body.mensaje === "string" && body.mensaje.trim()) item.mensaje = body.mensaje.trim();
      }
      if (espera && (body.estado === "contactada" || body.estado === "respondio")) espera.estado = body.estado;
      return Response.json({ estado: body.estado });
    },
  },
  {
    method: "GET",
    pattern: /^\/clientas\/([^/]+)$/,
    handler: ({ params: [id] }) => {
      const clienta = clientas.find((item) => item.id === decodeURIComponent(id));
      return clienta ? Response.json(ficha(clienta, Date.now())) : errorResponse(404, `No existe la clienta ${id}.`);
    },
  },
];
