import type { ApiRequest } from "../http";
import type { Banco, ClientaRef, Kpi } from "../types";

/** M7 · Cobros y conciliación: la app propone, la persona confirma. */

export type MovimientoBancario = {
  id: string;
  banco: Banco;
  /** Fecha y hora ISO en que entró al banco. */
  fecha: string;
  monto: number;
  titular: string;
  horasSinCargar: number;
};

export type PropuestaCruce = {
  id: string;
  movimiento: MovimientoBancario;
  pedido: { id: string; clienta: ClientaRef; total: number };
  /** 0 a 100. */
  puntaje: number;
  razones: { label: string; ok: boolean }[];
  estado: "propuesta" | "confirmada" | "rechazada";
};

export type SinCruce = {
  id: string;
  tipo: "movimiento_sin_pedido" | "comprobante_sin_movimiento";
  caso: "otro_alias" | "tercero" | "pago_sin_pedido";
  monto: number;
  banco: Banco | null;
  titular: string;
  /** Fecha y hora ISO. */
  fecha: string;
  detalle: string;
  sugerencia: string;
};

export type ExtractoBanco = {
  banco: Banco;
  /** Fecha y hora ISO del último import. */
  importadoAt: string;
  formato: string;
  movimientos: number;
  conciliados: number;
};

export type ComprobanteLeido = {
  id: string;
  clienta: string;
  /** Fecha y hora ISO en que llegó por WhatsApp. */
  recibidoAt: string;
  monto: number;
  banco: string;
  titular: string;
  operacion: string;
  pedidoId: string | null;
  confianza: number;
  estado: "conciliado" | "propuesto" | "sin_cruce";
};

export type ConciliacionResumen = {
  kpis: Kpi[];
  extractos: ExtractoBanco[];
  propuestas: PropuestaCruce[];
  sinCruce: SinCruce[];
  comprobantes: ComprobanteLeido[];
};

/** Tipos de caso de la rendición con Transtech (RN-46). */
export type TipoCasoContraentrega =
  | "entregado_sin_rendir"
  | "efectivo_chofer"
  | "otro_alias"
  | "pago_sin_pedido"
  | "envio_duplicado"
  | "rebote_fecha"
  | "devolucion_fisica";

export type CasoContraentrega = {
  id: string;
  pedidoId: string;
  clienta: ClientaRef;
  localidad: string;
  monto: number;
  grupo: "entregado_sin_rendir" | "en_camino" | "ausente";
  /** null: en seguimiento, todavía no es un caso para reclamar. */
  tipo: TipoCasoContraentrega | null;
  estadoZupply: string;
  /** Lo que arma la app cruzando DUX, Zupply, el banco y la conversación. */
  estadoReal: string;
  coincide: boolean;
  dias: number;
};

export type LiquidacionTranstech = {
  id: string;
  /** Fechas ISO (YYYY-MM-DD) de la ventana. */
  desde: string;
  hasta: string;
  rendido: number;
  reclamado: number;
  recuperado: number;
  estado: "en_reclamo" | "cerrada";
  nota: string;
};

export type ContraentregaResumen = {
  totales: {
    total: number;
    entregadosSinRendir: { casos: number; monto: number };
    enCamino: { casos: number; monto: number };
    ausentes: { casos: number; monto: number };
  };
  ciclo: { id: string; label: string; cantidad: number }[];
  casos: CasoContraentrega[];
  liquidaciones: LiquidacionTranstech[];
};

export type ReclamoTranstech = {
  /** Ventana de lunes a sábado (RN-45), fechas ISO. */
  desde: string;
  hasta: string;
  porTipo: { tipo: TipoCasoContraentrega; label: string; casos: number; monto: number }[];
  casos: number;
  total: number;
  mensaje: string;
  enviado: boolean;
};

/* ---- Caja del día (RF-M7-10, Manual v4 P-01 y P-11) ------------------------- */

export type CuentaCaja = {
  id: string;
  nombre: string;
  tipo: "banco" | "efectivo";
  saldo: number;
  /** Fecha y hora ISO del último saldo. */
  actualizadoAt: string;
  /** "extracto": sale del último extracto importado · "manual": lo cargó una persona. */
  origen: "extracto" | "manual";
};

export type CompromisoCaja = {
  id: string;
  concepto: string;
  monto: number;
  /** Fecha ISO (YYYY-MM-DD). */
  vence: string;
  tipo: "fijo" | "debito" | "escalonado";
};

export type IngresoEsperado = {
  id: string;
  concepto: string;
  detalle: string;
  monto: number;
  /** Fracción que se espera cobrar (de la contraentrega no entra el 15-20 %). */
  probabilidad: number;
};

export type SaldoProveedor = {
  id: string;
  proveedor: string;
  /** Lo que se le debe hoy. Al ir a comprar se cubre como mínimo esto (Manual v4 P-01 R-5). */
  saldo: number;
  condiciones: string;
  ultimaCompraDias: number;
};

/**
 * Cuánto se puede gastar hoy en mercadería: la cuenta que hoy Elías hace de
 * cabeza antes de salir a comprar. La app sugiere; decide el dueño (P-11 R-2).
 */
export type CajaDelDia = {
  /** Fecha ISO (YYYY-MM-DD). */
  fecha: string;
  cuentas: CuentaCaja[];
  disponible: number;
  compromisosHoy: CompromisoCaja[];
  /** Vencimientos de los próximos 10 días, sin los de hoy. */
  proximos: CompromisoCaja[];
  ingresos: IngresoEsperado[];
  /** Suma de cada ingreso por su probabilidad. */
  ingresosEsperados: number;
  /** Lo que hay que guardar para los próximos vencimientos que no cubren los ingresos esperados. */
  reserva: number;
  /** disponible − compromisos de hoy − reserva. */
  capacidadCompra: number;
  proveedores: SaldoProveedor[];
};

export function cobrosEndpoints(request: ApiRequest) {
  return {
    conciliacion: () => request<ConciliacionResumen>("/cobros/conciliacion"),
    confirmar: (id: string) =>
      request<{ ok: true; cobro: string }>(`/cobros/conciliacion/${encodeURIComponent(id)}/confirmar`, {
        method: "POST",
      }),
    rechazar: (id: string) =>
      request<{ ok: true }>(`/cobros/conciliacion/${encodeURIComponent(id)}/rechazar`, {
        method: "POST",
      }),
    confirmarAltos: () => request<{ confirmadas: number }>("/cobros/conciliacion/confirmar-altos", { method: "POST" }),
    contraentrega: () => request<ContraentregaResumen>("/cobros/contraentrega"),
    reclamo: () => request<ReclamoTranstech>("/cobros/contraentrega/reclamo"),
    enviarReclamo: () => request<{ ok: true }>("/cobros/contraentrega/reclamo", { method: "POST" }),
    caja: () => request<CajaDelDia>("/cobros/caja"),
    actualizarSaldo: (id: string, saldo: number) =>
      request<CuentaCaja>(`/cobros/caja/cuentas/${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify({ saldo }),
      }),
  };
}
