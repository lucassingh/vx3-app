import type {
  VidrieraAcceso,
  VidrieraColeccion,
  VidrieraDestacado,
  VidrieraResumen,
  VidrieraVistaProducto,
} from "@/lib/api/types";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import { bultosDisponibles, getProducto, PEDIDO_MINIMO, presentacionesDe } from "../seed";

/** M4 · Vidriera: contenido del catálogo maestro, precio y stock de DUX. */

const coleccionesSeed: VidrieraColeccion[] = [
  {
    id: "col-reel",
    nombre: "Lo del reel de hoy",
    descripcion: "El conjunto AmorArma CJATN14 y lo que combina",
    productos: 6,
    activa: true,
    visitas7d: 1_120,
  },
  {
    id: "col-conjuntos",
    nombre: "Conjuntos armados",
    descripcion: "Tres piezas, dos piezas y con culote",
    productos: 24,
    activa: true,
    visitas7d: 860,
  },
  {
    id: "col-grandes",
    nombre: "Talles grandes",
    descripcion: "Curvas desde XL y desde 100",
    productos: 31,
    activa: true,
    visitas7d: 540,
  },
  {
    id: "col-medias",
    nombre: "Medias por docena",
    descripcion: "Niño, hombre y deportivas",
    productos: 18,
    activa: true,
    visitas7d: 410,
  },
  { id: "col-hombre", nombre: "Hombre", descripcion: "Boxer y medias", productos: 12, activa: true, visitas7d: 190 },
  {
    id: "col-invierno",
    nombre: "Liquidación invierno",
    descripcion: "Térmicas con stock alto",
    productos: 9,
    activa: false,
    visitas7d: 70,
  },
];

const DESTACADOS: { sku: string; vistas7d: number; activo: boolean }[] = [
  { sku: "CJATN14", vistas7d: 1_480, activo: true },
  { sku: "CJATN31", vistas7d: 910, activo: true },
  { sku: "CAN9", vistas7d: 760, activo: true },
  { sku: "VN16", vistas7d: 640, activo: true },
  { sku: "LN35", vistas7d: 520, activo: true },
  { sku: "BMN1", vistas7d: 230, activo: false },
];

function destacado(sku: string, vistas7d: number, activo: boolean): VidrieraDestacado {
  const producto = getProducto(sku);
  const { bulto } = presentacionesDe(producto);
  return {
    sku,
    nombre: producto.nombre,
    colores: producto.colores,
    precio: bulto.precio,
    presentacion: bulto.label,
    stockBultos: bultosDisponibles(producto),
    vistas7d,
    activo,
  };
}

function vistaProducto(sku: string): VidrieraVistaProducto {
  const producto = getProducto(sku);
  const { bulto } = presentacionesDe(producto);
  const stockBultos = bultosDisponibles(producto);
  return {
    sku,
    link: `vx3.com.ar/p/${sku}`,
    nombre: producto.nombre,
    aclaracion: producto.aclaracion,
    presentacion: bulto.label,
    prendas: bulto.prendas,
    precio: bulto.precio,
    precioPrenda: Math.round(bulto.precio / bulto.prendas),
    talles: producto.talles,
    colores: producto.colores,
    stockBultos,
    quedanPocas: stockBultos <= 12,
    tela: producto.tela,
    carrito: bulto.precio,
    minimo: PEDIDO_MINIMO,
  };
}

const getVidriera = defineStore("vidriera", () => ({
  colecciones: structuredClone(coleccionesSeed),
  destacados: DESTACADOS.map(({ sku, vistas7d, activo }) => destacado(sku, vistas7d, activo)),
  acceso: "publico" as VidrieraAcceso,
}));

function resumen(): VidrieraResumen {
  const estado = getVidriera();
  return {
    kpis: [
      {
        id: "visitas",
        label: "Visitas · 7 días",
        value: 3_840,
        format: "number",
        delta: { value: 0.18, unit: "percent", period: "vs. la semana anterior", positive: true },
      },
      {
        id: "carritos",
        label: "Carritos armados",
        value: 412,
        format: "number",
        hint: "El 37 % llegó al mínimo de $ 45.000",
      },
      {
        id: "pedidos",
        label: "Pedidos confirmados",
        value: 46,
        format: "number",
        hint: "38 siguieron por WhatsApp con su número",
      },
      {
        id: "liberados",
        label: "Carritos liberados solos",
        value: 27,
        format: "number",
        hint: "Vencieron sin llegar a DUX: nada para anular",
      },
    ],
    embudo: [
      { id: "visitas", label: "Visitas", value: 3_840 },
      { id: "producto", label: "Vieron un producto", value: 2_912 },
      { id: "carrito", label: "Agregaron al carrito", value: 412 },
      { id: "minimo", label: "Llegaron al mínimo", value: 151 },
      { id: "confirmaron", label: "Confirmaron el pedido", value: 46 },
      { id: "whatsapp", label: "Siguieron por WhatsApp", value: 38 },
    ],
    colecciones: estado.colecciones,
    destacados: estado.destacados,
    acceso: estado.acceso,
    vista: vistaProducto("CJATN14"),
  };
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/vidriera$/, handler: () => Response.json(resumen()) },
  {
    method: "POST",
    pattern: /^\/vidriera\/colecciones\/orden$/,
    handler: async ({ request }) => {
      const estado = getVidriera();
      const { ids } = await readJson<{ ids: string[] }>(request);
      if (!Array.isArray(ids) || ids.length !== estado.colecciones.length) {
        return errorResponse(422, "El orden tiene que incluir todas las colecciones.");
      }
      const byId = new Map(estado.colecciones.map((coleccion) => [coleccion.id, coleccion]));
      const ordenadas = ids.map((id) => byId.get(id)).filter((item) => item !== undefined);
      if (ordenadas.length !== estado.colecciones.length) return errorResponse(422, "Hay colecciones que no existen.");
      estado.colecciones = ordenadas;
      return Response.json(estado.colecciones);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/vidriera\/colecciones\/([^/]+)$/,
    handler: async ({ params: [id], request }) => {
      const coleccion = getVidriera().colecciones.find((item) => item.id === decodeURIComponent(id));
      if (!coleccion) return errorResponse(404, `No existe la colección ${id}.`);
      const { activa } = await readJson<{ activa: boolean }>(request);
      if (typeof activa === "boolean") coleccion.activa = activa;
      return Response.json(coleccion);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/vidriera\/destacados\/([^/]+)$/,
    handler: async ({ params: [sku], request }) => {
      const item = getVidriera().destacados.find((destacadoItem) => destacadoItem.sku === decodeURIComponent(sku));
      if (!item) return errorResponse(404, `${sku} no está entre los destacados.`);
      const { activo } = await readJson<{ activo: boolean }>(request);
      if (typeof activo === "boolean") item.activo = activo;
      return Response.json(item);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/vidriera\/acceso$/,
    handler: async ({ request }) => {
      const { acceso } = await readJson<{ acceso: VidrieraAcceso }>(request);
      if (acceso !== "publico" && acceso !== "con_codigo") return errorResponse(422, "Modo de acceso inválido.");
      getVidriera().acceso = acceso;
      return Response.json({ acceso });
    },
  },
];
