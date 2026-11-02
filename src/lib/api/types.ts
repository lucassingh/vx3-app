/**
 * Contrato de la API. La API simulada (src/mocks) y la real deben respetarlo;
 * los componentes solo dependen de estos tipos.
 *
 * Acá van los tipos compartidos por varios módulos. Los de cada módulo viven
 * en src/lib/api/contracts/<dominio>.ts y se reexportan al final, así que
 * todo se importa desde "@/lib/api/types".
 */

/* ---- Genéricos ------------------------------------------------------------ */

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiErrorBody = {
  error: { status: number; message: string };
};

/** Formato de un indicador. Los porcentajes vienen como fracción: 0.032 = 3,2 %. */
export type MetricFormat = "number" | "percent" | "currency" | "usd" | "ratio";

/** Indicador para las grillas de KPIs (components/kit/kpi-grid.tsx). */
export type Kpi = {
  id: string;
  label: string;
  value: number;
  format: MetricFormat;
  delta?: {
    value: number;
    /** percent: fracción · points: puntos porcentuales · number: absoluto · currency: pesos. */
    unit: "percent" | "points" | "number" | "currency";
    period: string;
    /** Si el cambio es bueno para el negocio (define el color). */
    positive: boolean;
  };
  /** Bajada cuando no hay variación ("18 de 54 pedidos"). */
  hint?: string;
};

/** Punto de una serie diaria. */
export type DailyPoint = {
  /** Fecha ISO (YYYY-MM-DD). */
  date: string;
  value: number;
};

/** Fila de una lista de barras (components/kit/bar-list.tsx). */
export type Share = {
  id: string;
  label: string;
  value: number;
};

/* ---- Negocio (compartido entre módulos) ----------------------------------- */

/** Por dónde entró el pedido. */
export type Canal = "whatsapp" | "vidriera" | "local" | "tiendanube";

/** Por qué compró: un clic a un anuncio, una clienta que vuelve sin clic nuevo (RN-94) u orgánico. */
export type OrigenVenta = "anuncio" | "recompra" | "organico";

/** Ciclo de vida del pedido (RF-M5-01 y RF-M7-08). */
export type EstadoPedido =
  | "armandose"
  | "pendiente_pago"
  | "listo_facturar"
  | "facturado"
  | "en_armado"
  | "despachado"
  | "entregado"
  | "cobrado"
  | "rendido"
  | "devuelto"
  | "anulado";

/** Zona de envío (RN-81). La contraentrega es solo en AMBA y con mensajería (RN-29). */
export type Zona = "amba_1" | "amba_2" | "interior";

export type Transporte = "mensajeria" | "correo" | "via_cargo" | "retira";

export type MedioPago = "transferencia" | "contraentrega" | "efectivo" | "tarjeta";

export type Banco = "santander" | "supervielle" | "provincia" | "nacion";

/** Segmento de recompra (RF-M12-03). */
export type Segmento = "nueva" | "activa" | "top" | "en_riesgo" | "dormida";

/** Referencia liviana a una clienta, para listas de otros módulos. */
export type ClientaRef = {
  id: string;
  nombre: string;
  /** Teléfono normalizado para mostrar: "+54 9 11 5832-4410". */
  telefono: string;
};

/** Alerta del centro de alertas (RF-M0-05), en la campana de la navbar. */
export type Notification = {
  id: string;
  title: string;
  description: string;
  /** Fecha y hora ISO. */
  createdAt: string;
  read: boolean;
  /** Pantalla donde se resuelve. */
  href?: string;
};

/* ---- Contratos por módulo ------------------------------------------------- */

export type * from "./contracts/dashboard";
export type * from "./contracts/conversaciones";
export type * from "./contracts/bot";
export type * from "./contracts/vidriera";
export type * from "./contracts/clientas";
export type * from "./contracts/pauta";
export type * from "./contracts/pedidos";
export type * from "./contracts/envios";
export type * from "./contracts/cobros";
export type * from "./contracts/postventa";
export type * from "./contracts/catalogo";
export type * from "./contracts/stock";
export type * from "./contracts/plataforma";
