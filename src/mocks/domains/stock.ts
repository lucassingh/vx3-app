import { calcularPresentaciones, ceilTo, margenDe } from "@/components/productos/motor-precios";
import type {
  CapaCosto,
  CoeficientesPrecio,
  CompraHistorial,
  Kpi,
  MargenBajoPiso,
  Recepcion,
  RecepcionCarga,
  StockDiferencia,
  StockEstado,
  StockFila,
  StockProveedor,
} from "@/lib/api/types";
import { normalizeText } from "@/lib/utils";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import {
  bultosDisponibles,
  dateAgo,
  DAY,
  equipo,
  getProducto,
  HOUR,
  isoAgo,
  presentacionesDe,
  productos,
  proveedores,
  type ProductoSeed,
} from "../seed";

/** M2 · Stock, compras, costos y precios. */

/* ---- Espejo de stock ------------------------------------------------------ */

const plural = (label: string) => (label === "Media docena" ? "medias docenas" : `${label.toLowerCase()}s`);

function filaDe(producto: ProductoSeed): StockFila {
  const { bulto } = presentacionesDe(producto);
  const disponiblePrendas = Math.max(0, producto.stockPrendas - producto.reservadoPrendas);
  const disponibleBultos = Math.max(0, bultosDisponibles(producto));
  const sueltas = disponiblePrendas - disponibleBultos * bulto.prendas;
  const diasStock =
    producto.ventas30dBultos > 0 ? Math.round(disponibleBultos / (producto.ventas30dBultos / 30)) : null;

  const estado: StockEstado =
    disponibleBultos === 0
      ? "agotado"
      : diasStock === null
        ? "sin_rotacion"
        : diasStock < 7
          ? "critico"
          : diasStock > 60
            ? "sobrestock"
            : "ok";

  const unidad = disponibleBultos === 1 ? bulto.label.toLowerCase() : plural(bulto.label);
  return {
    sku: producto.sku,
    nombre: producto.nombre,
    rubro: producto.rubro,
    colores: producto.colores,
    bultoLabel: bulto.label,
    prendasPorBulto: bulto.prendas,
    stockPrendas: producto.stockPrendas,
    reservadoPrendas: producto.reservadoPrendas,
    disponiblePrendas,
    disponibleBultos,
    equivalencia: `${disponiblePrendas} prendas = ${disponibleBultos} ${unidad}${sueltas > 0 ? ` y ${sueltas} ${sueltas === 1 ? "suelta" : "sueltas"}` : ""}`,
    ventas30dBultos: producto.ventas30dBultos,
    diasStock,
    estado,
  };
}

const ESTADOS: StockEstado[] = ["agotado", "critico", "ok", "sobrestock", "sin_rotacion"];

function espejo(url: URL) {
  const q = normalizeText(url.searchParams.get("q")?.trim() ?? "");
  const rubro = url.searchParams.get("rubro");
  const estado = url.searchParams.get("estado") as StockEstado | null;
  const prioridad: Record<StockEstado, number> = { agotado: 0, critico: 1, sobrestock: 2, ok: 3, sin_rotacion: 4 };

  return productos
    .map(filaDe)
    .filter((fila) => (q ? normalizeText(`${fila.sku} ${fila.nombre}`).includes(q) : true))
    .filter((fila) => (rubro ? fila.rubro === rubro : true))
    .filter((fila) => (estado && ESTADOS.includes(estado) ? fila.estado === estado : true))
    .toSorted((a, b) => prioridad[a.estado] - prioridad[b.estado]);
}

function stockKpis(): Kpi[] {
  const filas = productos.map(filaDe);
  const reservado = filas.reduce((sum, fila) => sum + fila.reservadoPrendas, 0);
  const criticos = filas.filter((fila) => fila.estado === "critico" || fila.estado === "agotado").length;
  const codigos = productos.reduce((sum, producto) => sum + presentacionesDe(producto).lista.length, 0);
  return [
    {
      id: "skus",
      label: "Productos leídos de DUX",
      value: filas.length,
      format: "number",
      hint: `${codigos} códigos con sus packs`,
    },
    {
      id: "bultos",
      label: "Bultos disponibles",
      value: filas.reduce((sum, fila) => sum + fila.disponibleBultos, 0),
      format: "number",
      hint: "Real menos reservado, en bultos mayoristas",
    },
    {
      id: "reservado",
      label: "Reservado sin confirmar",
      value: reservado,
      format: "number",
      hint: "Prendas en carritos: se liberan solas si el pedido vence",
    },
    {
      id: "critico",
      label: "Stock crítico o agotado",
      value: criticos,
      format: "number",
      hint: "Alimenta la palanca “se está acabando” del bot",
    },
  ];
}

const getDiferencias = defineStore("stock-diferencias", (now): StockDiferencia[] => {
  const multiplicado = "Stock multiplicado por 6 en el cambio a stock por prenda del 10/10";
  const d = (
    id: string,
    sku: string,
    duxPrendas: number,
    contadoPrendas: number,
    detectadoEn: string,
    haceMin: number,
    causa: string,
    estado: StockDiferencia["estado"] = "pendiente",
  ) => ({
    id,
    sku,
    nombre: getProducto(sku).nombre,
    duxPrendas,
    contadoPrendas,
    detectadoEn,
    detectadoAt: isoAgo(haceMin, now),
    causa,
    estado,
  });
  return [
    d("d-5", "CAN12", 54, 9, "Armado de V-1050", 3 * HOUR, multiplicado),
    d("d-4", "VN14", 66, 11, "Armado de V-1044", DAY + 2 * HOUR, multiplicado),
    d("d-3", "HB3", 42, 7, "Armado de V-1044", DAY + 3 * HOUR, multiplicado),
    d(
      "d-2",
      "LG18",
      78,
      72,
      "Recuento de góndola",
      2 * DAY,
      "Faltan 6 prendas: posible venta en el salón sin facturar",
    ),
    d(
      "d-1",
      "CJATN2",
      9,
      3,
      "Armado de V-1051",
      2 * DAY + 5 * HOUR,
      "La reserva de V-1051 no se descontó en DUX",
      "propuesto",
    ),
  ];
});

/* ---- Margen y precios ----------------------------------------------------- */

const bajoPiso = (
  sku: string,
  proveedor: string,
  costoDocenaAnterior: number,
  costoDocenaNuevo: number,
  motivo: string,
): MargenBajoPiso => {
  const producto = getProducto(sku);
  const actual = calcularPresentaciones(producto.familia, sku, costoDocenaAnterior).find((p) => p.esBulto)!;
  const nuevo = calcularPresentaciones(producto.familia, sku, costoDocenaNuevo).find((p) => p.esBulto)!;
  return {
    sku,
    codigo: actual.codigo,
    nombre: producto.nombre,
    proveedor,
    costoDocenaAnterior,
    costoDocenaNuevo,
    precioActual: actual.precio,
    precioPiso: nuevo.precio,
    margenActual: margenDe(actual.precio, nuevo.costo),
    margenObjetivo: 1 - 1 / nuevo.coeficiente,
    motivo,
  };
};

const getMargen = defineStore("stock-margen", (now) => ({
  revisadoAt: isoAgo(5 * HOUR, now),
  bajoPiso: [
    bajoPiso("CAN12", "Victoria Martínez", 17_600, 18_860, "Aumentó el costo un 7,2 % en la compra del martes."),
    bajoPiso("CDTLN6", "Cintia", 52_000, 56_000, "Lista nueva de Cintia: +7,7 %."),
    bajoPiso("VN25", "Ricardo Flores", 8_500, 9_400, "Aumento del 10,6 % que no se pasó al precio."),
  ],
}));

/** Productos con el precio por debajo del piso (RN-18): los usa el Inicio (P-15). */
export function productosBajoPiso() {
  return getMargen().bajoPiso;
}

function margenKpis(): Kpi[] {
  const margenes = productos.map((producto) => {
    const { bulto } = presentacionesDe(producto);
    return margenDe(bulto.precio, bulto.costo);
  });
  return [
    {
      id: "controlados",
      label: "Productos controlados hoy",
      value: productos.length,
      format: "number",
      hint: "Todos los días a las 6:00, no solo los lunes",
    },
    {
      id: "bajo-piso",
      label: "Bajo el piso",
      value: getMargen().bajoPiso.length,
      format: "number",
      hint: "Con precio sugerido para corregir",
    },
    {
      id: "margen",
      label: "Margen promedio del bulto",
      value: margenes.reduce((a, b) => a + b, 0) / margenes.length,
      format: "percent",
      hint: "Con el costo vigente del stock (RN-109)",
    },
    {
      id: "capas",
      label: "Capas de costo por agotarse",
      value: CAPAS.length,
      format: "number",
      hint: "El precio baja cuando se termina el stock viejo",
    },
  ];
}

const capa = (
  sku: string,
  costoDocenaViejo: number,
  costoDocenaNuevo: number,
  prendasIngresadas: number,
  prendasRestantes: number,
): CapaCosto => {
  const producto = getProducto(sku);
  const actual = calcularPresentaciones(producto.familia, sku, costoDocenaViejo).find((p) => p.esBulto)!;
  const nuevo = calcularPresentaciones(producto.familia, sku, costoDocenaNuevo).find((p) => p.esBulto)!;
  const prendasPorDia = (producto.ventas30dBultos * actual.prendas) / 30;
  return {
    sku,
    nombre: producto.nombre,
    costoDocenaViejo,
    costoDocenaNuevo,
    prendasIngresadas,
    prendasRestantes,
    precioActual: actual.precio,
    precioAlAgotarse: nuevo.precio,
    diasEstimados: Math.max(1, Math.round(prendasRestantes / prendasPorDia)),
  };
};

const CAPAS: CapaCosto[] = [
  capa("VN16", 18_000, 16_500, 60, 42),
  capa("HB2", 19_800, 18_900, 36, 30),
  capa("LN35", 8_000, 7_400, 72, 18),
];

const COEFICIENTES: CoeficientesPrecio = {
  redondeo: 100,
  lenceria: [
    { presentacion: "Prenda", formula: "Costo de la prenda × 2,21", coeficiente: 2.21, listas: "LOCAL EF/TR" },
    {
      presentacion: "Media docena (-6)",
      formula: "Costo del combo × 1,30",
      coeficiente: 1.3,
      listas: "MAYORISTA EF/TR y LOCAL EF/TR",
    },
    {
      presentacion: "Docena (-12)",
      formula: "Costo del combo × 1,1765",
      coeficiente: 1.1765,
      listas: "MAYORISTA EF/TR y LOCAL EF/TR",
    },
  ],
  medias: [
    { presentacion: "Pack de 3 (-3)", formula: "Costo del combo × 2,21", coeficiente: 2.21, listas: "LOCAL EF/TR" },
    { presentacion: "Pack de 6 (-6)", formula: "Costo del combo × 1,8182", coeficiente: 1.8182, listas: "LOCAL EF/TR" },
    {
      presentacion: "Docena (-12)",
      formula: "Costo del combo × 1,30",
      coeficiente: 1.3,
      listas: "MAYORISTA EF/TR y LOCAL EF/TR",
    },
    {
      presentacion: "Dos docenas (-24)",
      formula: "Costo del combo × 1,1765",
      coeficiente: 1.1765,
      listas: "MAYORISTA EF/TR y LOCAL EF/TR",
    },
  ],
};

/* ---- Compras -------------------------------------------------------------- */

const renglon = (
  id: string,
  sku: string,
  boletaBultos: number,
  contadoBultos: number,
  costoDocenaNuevo: number | null = null,
) => {
  const producto = getProducto(sku);
  const { bulto } = presentacionesDe(producto);
  return {
    id,
    codigo: bulto.codigo,
    sku,
    nombre: producto.nombre,
    colores: producto.colores,
    familia: producto.familia,
    prendasPorBulto: bulto.prendas,
    boletaBultos,
    contadoBultos,
    nuevo: false,
    costoDocenaActual: producto.costoDocena,
    costoDocenaNuevo,
  };
};

const getCompras = defineStore("stock-compras", (now) => {
  const recepcion: Recepcion = {
    id: "RC-0143",
    proveedorId: "p-bethy",
    proveedor: "Bethy",
    proveedorTipo: "mayorista",
    boleta: "0001-00004821",
    fecha: dateAgo(0, now),
    recibidoPor: "Juan",
    firmantes: equipo
      .filter((usuario) => usuario.nombre !== "Juan" && usuario.id !== "u-masuno")
      .map((usuario) => usuario.nombre),
    firmadoPor: null,
    renglones: [
      renglon("r-1", "CJATN14", 6, 6),
      renglon("r-2", "CJATN31", 4, 3),
      renglon("r-3", "CAG1", 3, 3, 37_500),
      renglon("r-4", "LG18", 5, 5),
      renglon("r-5", "BMN1", 6, 7),
      renglon("r-6", "DSN5", 2, 2),
      {
        id: "r-7",
        codigo: "CJATN42-6",
        sku: "CJATN42",
        nombre: "Conjunto armado tres piezas Condeza con puntilla",
        colores: ["Negro", "Blanco", "Rosa", "Bordó"],
        familia: "lenceria",
        prendasPorBulto: 6,
        boletaBultos: 4,
        contadoBultos: 4,
        nuevo: true,
        costoDocenaActual: 58_000,
        costoDocenaNuevo: null,
      },
    ],
  };

  const historial: CompraHistorial[] = [
    {
      id: "C-0142",
      proveedor: "Bethy",
      boleta: "0001-00004797",
      fecha: dateAgo(3, now),
      bultos: 41,
      monto: 1_420_000,
      faltantes: 0,
      estado: "cargada",
      firmadaPor: "Leo",
    },
    {
      id: "C-0141",
      proveedor: "Ricardo Flores",
      boleta: "0003-00011872",
      fecha: dateAgo(6, now),
      bultos: 38,
      monto: 412_000,
      faltantes: 0,
      estado: "cargada",
      firmadaPor: "Leo",
    },
    {
      id: "C-0140",
      proveedor: "Victoria Martínez",
      boleta: "0002-00000981",
      fecha: dateAgo(9, now),
      bultos: 22,
      monto: 518_000,
      faltantes: 2,
      estado: "con_faltantes",
      firmadaPor: "Leo",
    },
    {
      id: "C-0139",
      proveedor: "Cintia",
      boleta: "0001-00000377",
      fecha: dateAgo(11, now),
      bultos: 14,
      monto: 646_000,
      faltantes: 0,
      estado: "cargada",
      firmadaPor: "Elías Llaury",
    },
    {
      id: "C-0138",
      proveedor: "Carmen",
      boleta: "0001-00000212",
      fecha: dateAgo(14, now),
      bultos: 18,
      monto: 81_000,
      faltantes: 0,
      estado: "cargada",
      firmadaPor: "Leo",
    },
    {
      id: "C-0137",
      proveedor: "Silvia (Cativa)",
      boleta: "0004-00002140",
      fecha: dateAgo(18, now),
      bultos: 12,
      monto: 264_000,
      faltantes: 1,
      estado: "con_faltantes",
      firmadaPor: "Leo",
    },
  ];

  return { recepcion, cargada: false, historial };
});

async function cargarRecepcion(request: Request) {
  const carga = await readJson<RecepcionCarga>(request);
  const compras = getCompras();
  if (compras.cargada) return errorResponse(409, "Esta recepción ya se cargó en DUX.");
  if (!carga.firmadoPor || carga.firmadoPor === compras.recepcion.recibidoPor) {
    return errorResponse(422, "La recepción la tiene que revisar y firmar otra persona (RN-37).");
  }

  const contados = new Map((carga.renglones ?? []).map((item) => [item.id, item]));
  const renglones = compras.recepcion.renglones.map((item) => ({
    ...item,
    contadoBultos: contados.get(item.id)?.contadoBultos ?? item.contadoBultos,
    costoDocenaNuevo: contados.get(item.id)?.costoDocenaNuevo ?? item.costoDocenaNuevo,
  }));
  const bultos = renglones.reduce((sum, item) => sum + item.contadoBultos, 0);
  const faltantes = renglones.reduce((sum, item) => sum + Math.max(0, item.boletaBultos - item.contadoBultos), 0);
  const monto = renglones.reduce(
    (sum, item) =>
      sum + ((item.costoDocenaNuevo ?? item.costoDocenaActual) * item.prendasPorBulto * item.contadoBultos) / 12,
    0,
  );

  compras.cargada = true;
  compras.recepcion = { ...compras.recepcion, firmadoPor: carga.firmadoPor, renglones };
  compras.historial.unshift({
    id: "C-0143",
    proveedor: compras.recepcion.proveedor,
    boleta: compras.recepcion.boleta,
    fecha: compras.recepcion.fecha,
    bultos,
    monto: ceilTo(monto, 100),
    faltantes,
    estado: faltantes > 0 ? "con_faltantes" : "cargada",
    firmadaPor: carga.firmadoPor,
  });

  return Response.json({
    comprobante: "OC 0001-00000913",
    bultos,
    preciosActualizados: renglones.filter((item) => item.costoDocenaNuevo !== null || item.nuevo).length,
  });
}

/* ---- Proveedores ---------------------------------------------------------- */

function listarProveedores(): StockProveedor[] {
  return proveedores.map((proveedor) => ({
    ...proveedor,
    productos: productos
      .filter((producto) => producto.proveedorId === proveedor.id)
      .map((producto) => ({
        sku: producto.sku,
        nombre: producto.nombre,
        colores: producto.colores,
        costoDocena: producto.costoDocena,
        disponibleBultos: Math.max(0, bultosDisponibles(producto)),
      })),
  }));
}

export const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/stock\/sync$/,
    handler: () => {
      const codigos = productos.reduce((sum, producto) => sum + presentacionesDe(producto).lista.length, 0);
      return Response.json({
        ultimaLectura: isoAgo(2, Date.now()),
        intervaloMin: 3,
        llamadas: Math.ceil(codigos / 50),
        codigos,
        duracionS: 1.4,
        errores24h: 0,
      });
    },
  },
  { method: "GET", pattern: /^\/stock\/kpis$/, handler: () => Response.json(stockKpis()) },
  { method: "GET", pattern: /^\/stock\/espejo$/, handler: ({ url }) => Response.json(espejo(url)) },
  { method: "GET", pattern: /^\/stock\/diferencias$/, handler: () => Response.json(getDiferencias()) },
  {
    method: "POST",
    pattern: /^\/stock\/diferencias\/([^/]+)\/ajuste$/,
    handler: ({ params: [id] }) => {
      const diferencia = getDiferencias().find((item) => item.id === decodeURIComponent(id));
      if (!diferencia) return errorResponse(404, `No existe la diferencia ${id}.`);
      diferencia.estado = "propuesto";
      return Response.json(diferencia);
    },
  },
  { method: "GET", pattern: /^\/stock\/margen\/kpis$/, handler: () => Response.json(margenKpis()) },
  {
    method: "GET",
    pattern: /^\/stock\/margen$/,
    handler: () => {
      const margen = getMargen();
      const margenes = productos.map((producto) => {
        const { bulto } = presentacionesDe(producto);
        return margenDe(bulto.precio, bulto.costo);
      });
      return Response.json({
        revisadoAt: margen.revisadoAt,
        productosControlados: productos.length,
        margenPromedio: margenes.reduce((a, b) => a + b, 0) / margenes.length,
        bajoPiso: margen.bajoPiso,
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/stock\/margen\/([^/]+)\/corregir$/,
    handler: ({ params: [sku] }) => {
      const margen = getMargen();
      const item = margen.bajoPiso.find((row) => row.sku === decodeURIComponent(sku));
      if (!item) return errorResponse(404, `${sku} no está bajo el piso.`);
      margen.bajoPiso = margen.bajoPiso.filter((row) => row !== item);
      return Response.json({ sku: item.sku, codigo: item.codigo, precio: item.precioPiso });
    },
  },
  { method: "GET", pattern: /^\/stock\/capas$/, handler: () => Response.json(CAPAS) },
  { method: "GET", pattern: /^\/stock\/coeficientes$/, handler: () => Response.json(COEFICIENTES) },
  {
    method: "POST",
    pattern: /^\/stock\/etiquetas$/,
    handler: async ({ request }) => {
      const { rubro } = await readJson<{ rubro?: string }>(request);
      const conStock = productos.filter(
        (producto) => producto.stockPrendas > 0 && (!rubro || producto.rubro === rubro),
      );
      // RN-107: el bulto lleva una etiqueta por docena con el precio por docena; la prenda, una por unidad.
      return Response.json({
        etiquetas: conStock.length * 2,
        sinPrecio: rubro ? 0 : 1,
        archivo: `etiquetas-salon${rubro ? `-${normalizeText(rubro).replace(/\s+/g, "-")}` : ""}.pdf`,
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/stock\/recepcion$/,
    handler: () => Response.json(getCompras().recepcion),
  },
  { method: "POST", pattern: /^\/stock\/recepcion\/cargar$/, handler: ({ request }) => cargarRecepcion(request) },
  { method: "GET", pattern: /^\/stock\/compras$/, handler: () => Response.json(getCompras().historial) },
  { method: "GET", pattern: /^\/stock\/proveedores$/, handler: () => Response.json(listarProveedores()) },
];
