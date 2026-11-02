import type {
  Canal,
  ChequeoFacturacion,
  EstadoPedido,
  FacturaEmitida,
  PasoCicloPedido,
  PedidoBandeja,
  PedidoFacturable,
  PedidoTrabado,
  PedidosLista,
} from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { BANCO, ESTADO_PEDIDO, ZONA } from "@/lib/domain";
import { normalizeText } from "@/lib/utils";
import { defineStore } from "../db";
import { paginate, readJson, type Route } from "../http";
import {
  bultosDisponibles,
  DAY,
  detalleDe,
  getAnuncio,
  getClienta,
  getProducto,
  isoAgo,
  PEDIDO_MINIMO,
  pedidos as seedPedidos,
  presentacionesDe,
  TARIFAS,
  type PedidoSeed,
} from "../seed";

/** M5 · Pedidos y facturación. Facturar cambia el estado en la bandeja y en el despacho. */

type FacturaState = {
  numero: string;
  pedidoId: string;
  emitidaAt: number;
  fiscal: boolean;
  /** Estado fijo para las facturas de la semilla; las nuevas avanzan solas con el tiempo. */
  arcaFijo?: FacturaEmitida["arca"];
  remito: FacturaEmitida["remito"];
};

function createDb(now: number) {
  const pedidos: PedidoSeed[] = structuredClone(seedPedidos);
  const facturas: FacturaState[] = pedidos
    .filter((pedido) => pedido.factura && pedido.creadoHaceMin < DAY)
    .map((pedido) => ({
      numero: pedido.factura!,
      pedidoId: pedido.id,
      emitidaAt: now - Math.max(5, pedido.creadoHaceMin - 25) * 60_000,
      fiscal: pedido.factura!.startsWith("FC"),
      arcaFijo: pedido.id === "V-1051" ? "validado" : "cae",
      remito: pedido.estado === "facturado" ? "en_cola" : "impreso",
    }));
  return { now, pedidos, facturas, nextCv: 31_878, nextFc: 18_432 };
}

export const getPedidosDb = defineStore("pedidos", createDb);

/** Minutos desde la creación, contando el tiempo que pasó desde que arrancó el servidor. */
function haceMin(pedido: PedidoSeed) {
  return pedido.creadoHaceMin + Math.round((Date.now() - getPedidosDb().now) / 60_000);
}

/* ---- Ciclo de vida -------------------------------------------------------- */

function recorridoDe(pedido: PedidoSeed): EstadoPedido[] {
  if (pedido.transporte === "retira") return ["armandose", "facturado", "entregado"];
  if (pedido.pago === "contraentrega") {
    return ["armandose", "listo_facturar", "facturado", "en_armado", "despachado", "entregado", "cobrado", "rendido"];
  }
  return ["armandose", "pendiente_pago", "listo_facturar", "facturado", "en_armado", "despachado", "entregado"];
}

function pasosDe(pedido: PedidoSeed, now: number): PasoCicloPedido[] {
  const recorrido = recorridoDe(pedido);
  const final = pedido.estado === "anulado" || pedido.estado === "devuelto" ? pedido.estado : null;
  // Un pedido anulado se cae armándose; uno devuelto, después de despacharse.
  const alcanzado = final === "anulado" ? 0 : final === "devuelto" ? recorrido.indexOf("despachado") : recorrido.indexOf(pedido.estado);
  const pasos = final ? [...recorrido.slice(0, alcanzado + 1), final] : recorrido;
  const actual = final ? pasos.length - 1 : alcanzado;
  const minutos = haceMin(pedido);

  return pasos.map((estado, index) => ({
    estado,
    hecho: index <= actual,
    actual: index === actual,
    at: index <= actual ? isoAgo(Math.round(minutos * (1 - index / (actual + 1))), now) : null,
  }));
}

/* ---- Vista de un pedido --------------------------------------------------- */

export function toPedidoBandeja(pedido: PedidoSeed, now = Date.now()): PedidoBandeja {
  const clienta = getClienta(pedido.clientaId);
  const detalle = detalleDe(pedido);
  const minutos = haceMin(pedido);

  return {
    id: pedido.id,
    clienta: {
      id: clienta.id,
      nombre: clienta.nombre,
      telefono: clienta.telefono,
      localidad: clienta.localidad,
      cp: clienta.cp,
      zona: clienta.zona,
    },
    canal: pedido.canal,
    origen: pedido.origen,
    anuncio: pedido.anuncioId ? getAnuncio(pedido.anuncioId).nombre : undefined,
    resumen: detalle.lineas.map((linea) => `${linea.codigo} ×${linea.bultos}`).join(" · "),
    bultos: detalle.lineas.reduce((sum, linea) => sum + linea.bultos, 0),
    lineas: detalle.lineas.map(({ codigo, nombre, presentacion, bultos, precioUnitario, subtotal }) => ({
      codigo, nombre, presentacion, bultos, precioUnitario, subtotal,
    })),
    mercaderia: detalle.mercaderia,
    envio: detalle.envio,
    embalaje: detalle.embalaje,
    total: detalle.total,
    pesoKg: detalle.pesoKg,
    faltaParaMinimo: detalle.faltaParaMinimo,
    transporte: pedido.transporte,
    pago: pedido.pago,
    banco: pedido.banco,
    estado: pedido.estado,
    creadoAt: isoAgo(minutos, now),
    factura: pedido.factura,
    nota: pedido.nota,
    // RN-70: se interviene a los 30 minutos; sin respuesta después de 2 h, o bajo el mínimo, queda trabado.
    trabado: pedido.estado === "armandose" && (minutos > 120 || (detalle.faltaParaMinimo > 0 && minutos > 30)),
    pasos: pasosDe(pedido, now),
  };
}

function lista(url: URL): PedidosLista {
  const q = normalizeText(url.searchParams.get("q")?.trim() ?? "");
  const canal = url.searchParams.get("canal") as Canal | null;
  const estado = url.searchParams.get("estado") as EstadoPedido | null;

  const now = Date.now();
  const base = getPedidosDb()
    .pedidos.toSorted((a, b) => a.creadoHaceMin - b.creadoHaceMin)
    .map((pedido) => toPedidoBandeja(pedido, now))
    .filter((pedido) =>
      q
        ? normalizeText(
            `${pedido.id} ${pedido.clienta.nombre} ${pedido.clienta.telefono.replace(/\D/g, "")} ${pedido.clienta.localidad} ${pedido.factura ?? ""}`,
          ).includes(q.replace(/^#/, ""))
        : true,
    )
    .filter((pedido) => (canal ? pedido.canal === canal : true));

  const conteos: PedidosLista["conteos"] = {};
  for (const pedido of base) conteos[pedido.estado] = (conteos[pedido.estado] ?? 0) + 1;

  const valido = estado && estado in ESTADO_PEDIDO ? estado : null;
  const rows = valido ? base.filter((pedido) => pedido.estado === valido) : base;
  return { ...paginate(rows, url, 8), conteos, totalSinEstado: base.length };
}

/* ---- Trabados (RN-70 a RN-77) --------------------------------------------- */

function trabados(): PedidoTrabado[] {
  const now = Date.now();
  return getPedidosDb()
    .pedidos.map((pedido) => toPedidoBandeja(pedido, now))
    .filter((pedido) => pedido.trabado)
    .toSorted((a, b) => a.creadoAt.localeCompare(b.creadoAt))
    .map((pedido): PedidoTrabado => {
      const minutos = Math.round((now - Date.parse(pedido.creadoAt)) / 60_000);
      const nombre = pedido.clienta.nombre.split(" ")[0];

      if (pedido.faltaParaMinimo > 0) {
        const sugerido = presentacionesDe(getProducto("CJALN1")).bulto;
        return {
          pedido,
          motivo: "bajo_minimo",
          ultimoMensaje: `${nombre}, para llegar al mínimo de ${formatCurrency(PEDIDO_MINIMO)} te faltan ${formatCurrency(pedido.faltaParaMinimo)}. ¿Querés sumar media docena del conjunto Linda Luna con less regulable (${formatCurrency(sugerido.precio)})? Lo agrego a este mismo pedido, no hace falta armar uno nuevo 🙌`,
          pasos: [
            { id: "falta", label: "Le dijo cuánto falta para el mínimo", estado: "hecho", at: isoAgo(minutos - 5, now) },
            { id: "complementario", label: "Le propuso un complementario por la diferencia", estado: "hecho", at: isoAgo(minutos - 6, now) },
            { id: "tarde", label: "Seguimiento de la tarde", estado: "proximo", at: null },
            { id: "anular", label: "A las 24 h se anula y se libera la reserva", estado: "pendiente", at: null },
          ],
        };
      }

      const disponibles = bultosDisponibles(getProducto(pedido.lineas[0].codigo.replace(/-\d+$/, "")));
      return {
        pedido,
        motivo: "sin_respuesta",
        palanca: `Se está acabando: quedan ${disponibles} bultos de ${pedido.lineas[0].codigo}`,
        ultimoMensaje: `¡Hola ${nombre}! Te sigo guardando el pedido 😊 El conjunto se está moviendo mucho y quedan pocas medias docenas en tus colores. ¿Te lo confirmo así sale mañana temprano?`,
        pasos: [
          { id: "30m", label: "A los 30 minutos · primer mensaje", estado: "hecho", at: isoAgo(minutos - 30, now) },
          { id: "tarde", label: "Esa tarde · segundo mensaje", estado: "hecho", at: isoAgo(Math.max(5, minutos - 150), now) },
          { id: "manana", label: "Mañana a la mañana · tercer mensaje", estado: "proximo", at: null },
          { id: "anular", label: "A las 24 h se anula y se libera la reserva", estado: "pendiente", at: null },
        ],
      };
    });
}

/* ---- Facturación (RN-21 a RN-29) ------------------------------------------ */

const ETIQUETA = {
  mensajeria_contraentrega: "Mensajería contraentrega",
  mensajeria: "Mensajería ya abonado",
  correo: "Correo · domicilio",
  via_cargo: "Vía Cargo · sucursal",
  retira: "Retira por local + saldo",
} as const;

function facturable(pedido: PedidoBandeja, nota?: string): PedidoFacturable {
  const transferencia = pedido.pago === "transferencia";
  const contraentrega = pedido.pago === "contraentrega";
  const zona = ZONA[pedido.clienta.zona];
  const pagoConfirmado = transferencia && pedido.estado === "listo_facturar";
  const comprobanteRecibido = pagoConfirmado || Boolean(nota?.startsWith("Comprobante recibido"));
  const banco = pedido.banco ? BANCO[pedido.banco] : null;

  const chequeos: ChequeoFacturacion[] = [
    {
      id: "comprobante",
      label: "Comprobante de pago",
      estado: !transferencia ? "na" : comprobanteRecibido ? "ok" : "falla",
      detalle: !transferencia
        ? contraentrega ? "Contraentrega: se cobra en la entrega" : "Se cobra en el local"
        : comprobanteRecibido
          ? `Leído en el chat${banco ? ` · ${banco}` : ""}`
          : "La clienta todavía no mandó el comprobante",
    },
    {
      id: "monto",
      label: "Monto que coincide",
      estado: !transferencia ? "na" : pagoConfirmado ? "ok" : "falla",
      detalle: !transferencia
        ? "Se controla en la rendición"
        : pagoConfirmado
          ? `Coincide al peso: ${formatCurrency(pedido.total)}`
          : `Todavía no aparece el movimiento${banco ? ` en ${banco}` : " en ningún banco"}`,
    },
    {
      id: "destino",
      label: "Código postal y zona",
      estado: "ok",
      detalle: `CP ${pedido.clienta.cp} es de ${pedido.clienta.localidad} · ${zona.label}`,
    },
    {
      id: "minimo",
      label: `Mínimo de ${formatCurrency(PEDIDO_MINIMO)}`,
      estado: pedido.faltaParaMinimo > 0 ? "aviso" : "ok",
      detalle:
        pedido.faltaParaMinimo > 0
          ? `Queda ${formatCurrency(pedido.faltaParaMinimo)} abajo: va con la tarifa diferencial (RN-20)`
          : `Mercadería ${formatCurrency(pedido.mercaderia)}`,
    },
    {
      id: "transporte",
      label: "Transporte compatible con el pago",
      estado: contraentrega && (pedido.transporte !== "mensajeria" || pedido.clienta.zona === "interior") ? "falla" : "ok",
      detalle: contraentrega ? "Contraentrega en AMBA con mensajería" : "Pago anticipado: cualquier transporte",
    },
    {
      id: "codigos",
      label: "Sin códigos viejos",
      estado: "ok",
      detalle: "Todos los códigos son posteriores al corte del 10/10",
    },
  ];

  const items =
    pedido.transporte === "mensajeria"
      ? [
          { codigo: "EMBALAJE1", descripcion: "Embalaje mensajería", monto: TARIFAS.embalaje1 },
          {
            codigo: pedido.clienta.zona === "amba_1" ? "ENVIO1" : "ENVIO2",
            descripcion: `Envío mensajería · ${zona.short}`,
            monto: pedido.envio,
          },
        ]
      : pedido.transporte === "correo"
        ? [
            { codigo: "EMBALAJE2", descripcion: "Embalaje Correo", monto: TARIFAS.embalaje2 },
            { codigo: "ENVIO5", descripcion: `Envío Correo · cotización C-${pedido.id.slice(2)}`, monto: pedido.envio },
          ]
        : pedido.transporte === "via_cargo"
          ? [{ codigo: "EMBALAJE2", descripcion: "Embalaje · el flete lo paga la clienta", monto: TARIFAS.embalaje2 }]
          : [];

  return {
    pedido,
    chequeos,
    listo: chequeos.every((chequeo) => chequeo.estado !== "falla"),
    campos: {
      tipoComprobante: transferencia ? "Factura" : "Comprobante de venta",
      puntoVenta: "2 - MONOTRIBUTO ELIAS",
      lista: "MAYORISTA EF/TR",
      etiqueta:
        pedido.transporte === "mensajeria" && contraentrega
          ? ETIQUETA.mensajeria_contraentrega
          : ETIQUETA[pedido.transporte],
      items,
      cobranza: contraentrega
        ? "Vacía: se cobra en la entrega"
        : `Cuenta · ${banco ?? "banco a confirmar"} · ${formatCurrency(pedido.total)}`,
    },
  };
}

function facturables(): PedidoFacturable[] {
  const now = Date.now();
  return getPedidosDb()
    .pedidos.filter((pedido) => pedido.estado === "listo_facturar" || pedido.estado === "pendiente_pago")
    .toSorted((a, b) => b.creadoHaceMin - a.creadoHaceMin)
    .map((pedido) => facturable(toPedidoBandeja(pedido, now), pedido.nota))
    .toSorted((a, b) => Number(b.listo) - Number(a.listo));
}

function toFactura(factura: FacturaState, now: number): FacturaEmitida {
  const pedido = getPedidosDb().pedidos.find((item) => item.id === factura.pedidoId)!;
  const minutos = (now - factura.emitidaAt) / 60_000;
  const arca: FacturaEmitida["arca"] = !factura.fiscal
    ? "no_aplica"
    : (factura.arcaFijo ?? (minutos < 1 ? "pendiente" : minutos < 3 ? "validado" : "cae"));
  return {
    numero: factura.numero,
    pedidoId: factura.pedidoId,
    clienta: getClienta(pedido.clientaId).nombre,
    total: detalleDe(pedido).total,
    emitidaAt: new Date(factura.emitidaAt).toISOString(),
    arca,
    cae: arca === "cae" ? `7643${factura.numero.replace(/\D/g, "").slice(-10)}` : undefined,
    remito: factura.remito,
  };
}

function facturar(ids: string[]) {
  const db = getPedidosDb();
  const listos = new Set(facturables().filter((item) => item.listo).map((item) => item.pedido.id));
  const now = Date.now();
  const emitidas: FacturaState[] = [];

  for (const pedido of db.pedidos) {
    if (!ids.includes(pedido.id) || !listos.has(pedido.id)) continue;
    const fiscal = pedido.pago === "transferencia";
    const numero = fiscal
      ? `FC-B 0002-000${db.nextFc++}`
      : `CV 0002-000${db.nextCv++}`;
    pedido.estado = "facturado";
    pedido.factura = numero;
    pedido.nota = undefined;
    emitidas.push({ numero, pedidoId: pedido.id, emitidaAt: now, fiscal, remito: "en_cola" });
  }
  db.facturas.unshift(...emitidas);
  return emitidas.map((factura) => toFactura(factura, now));
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/pedidos$/, handler: ({ url }) => Response.json(lista(url)) },
  { method: "GET", pattern: /^\/pedidos\/trabados$/, handler: () => Response.json(trabados()) },
  { method: "GET", pattern: /^\/pedidos\/facturables$/, handler: () => Response.json(facturables()) },
  {
    method: "GET",
    pattern: /^\/pedidos\/facturas$/,
    handler: () => {
      const now = Date.now();
      return Response.json(
        getPedidosDb()
          .facturas.toSorted((a, b) => b.emitidaAt - a.emitidaAt)
          .map((factura) => toFactura(factura, now)),
      );
    },
  },
  {
    method: "POST",
    pattern: /^\/pedidos\/facturar$/,
    handler: async ({ request }) => {
      const { ids } = await readJson<{ ids: string[] }>(request);
      return Response.json({ facturas: facturar(Array.isArray(ids) ? ids : []) });
    },
  },
];
