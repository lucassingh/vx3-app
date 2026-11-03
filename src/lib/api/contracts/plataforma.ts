import { toQueryString, type ApiRequest } from "../http";
import type { DailyPoint, Share } from "../types";

/**
 * M0 · Plataforma: reglas de negocio, integraciones, IA y consumo, usuarios,
 * auditoría, preferencias de alertas y la cuenta del usuario.
 */

/* ---- Reglas de negocio (RF-M0-02) ----------------------------------------- */

export type ReglaGrupo = "precios" | "pedidos" | "envios" | "cobros" | "postventa" | "bot" | "pauta";

export type ReglaTipo =
  "coeficiente" | "porcentaje" | "moneda" | "numero" | "hora" | "texto" | "seleccion" | "booleano";

export type ReglaValor = number | string | boolean | null;

export type ReglaNegocio = {
  id: string;
  /** ID del catálogo de reglas (solucion_doc/02): "RN-11". */
  codigo: string;
  grupo: ReglaGrupo;
  nombre: string;
  descripcion: string;
  tipo: ReglaTipo;
  /** null = todavía sin definir (solo en reglas a confirmar). */
  valor: ReglaValor;
  /** Unidad corta de los números ("horas", "días", "min"). */
  unidad?: string;
  opciones?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** El valor falta confirmarlo con VX3. */
  aConfirmar?: boolean;
  nota?: string;
  /** Fecha ISO (YYYY-MM-DD). */
  vigenciaDesde: string;
  actualizadoPor: string;
  /** Fecha y hora ISO. */
  actualizadoEn: string;
};

export type CambioRegla = {
  id: string;
  reglaId: string;
  codigo: string;
  nombre: string;
  antes: string;
  despues: string;
  por: string;
  /** Fecha y hora ISO. */
  en: string;
};

export type CambioReglaInput = { id: string; valor: ReglaValor };

/* ---- Integraciones (RF-M0-04, RF-M0-06) ----------------------------------- */

export type IntegracionEstado = "ok" | "degradado" | "caido" | "pendiente";

export type CredencialEnmascarada = {
  /** Solo los últimos caracteres: "••••7c1e". */
  mascara: string;
  cargadaPor: string;
  /** Fecha y hora ISO. */
  cargadaEn: string;
};

export type Integracion = {
  id: string;
  nombre: string;
  /** "ERP · API v2", "Extracto bancario"… */
  tipo: string;
  estado: IntegracionEstado;
  detalle: string;
  frecuencia: string;
  /** Fecha y hora ISO; null si nunca sincronizó. */
  ultimoSync: string | null;
  metricas: { label: string; value: string }[];
  credencial: CredencialEnmascarada | null;
  /** Se alimenta importando un archivo (extractos, export de Zupply). */
  importa?: boolean;
  /** Pantalla relacionada ("Ver consumo"). */
  enlace?: { label: string; href: string };
};

export type SyncLogEntry = {
  id: string;
  integracionId: string;
  integracion: string;
  operacion: string;
  resultado: "ok" | "reintento" | "error";
  detalle: string;
  duracionMs: number;
  /** Fecha y hora ISO. */
  en: string;
};

export type PruebaConexion = { ok: boolean; latenciaMs: number; mensaje: string };

/* ---- IA y consumo (RF-M0-07) ---------------------------------------------- */

export type IaModelo = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Costo mensual estimado del bot con este modelo (escenario realista, `05` §4.5). */
  costoMesUsd: number;
};

export type IaConfig = {
  apiKey: CredencialEnmascarada | null;
  adminKey: CredencialEnmascarada | null;
  modelo: string;
  modelos: IaModelo[];
  topeMensualUsd: number;
  /** Fracción del tope a la que se avisa: 0.8 = 80 %. */
  alertaPct: number;
};

export type IaConsumo = {
  costo30dUsd: number;
  proyeccionMesUsd: number;
  conversaciones30d: number;
  costoPorConversacionUsd: number;
  tokens30d: number;
  /** Fracción de los tokens de entrada que salió de la caché. */
  pctCache: number;
  /** Gasto diario en USD; el último valor es hoy. */
  diario: DailyPoint[];
  /** Gasto en USD por tipo de caso. */
  porCaso: Share[];
};

/* ---- Usuarios, roles y auditoría (RF-M0-01, RF-M0-03, `06` §4) ------------- */

export type RolUsuario = "admin" | "operaciones" | "postventa" | "compras" | "marketing" | "solo_lectura";

export type UsuarioEquipo = {
  id: string;
  nombre: string;
  email: string | null;
  rol: RolUsuario;
  puesto: string;
  /** Fecha y hora ISO; null si nunca entró. */
  ultimoAcceso: string | null;
  dosFactores: boolean;
  estado: "activo" | "invitado";
};

export type NivelPermiso = "edita" | "ve" | "no";

export type MatrizPermisos = {
  roles: { id: RolUsuario; nombre: string; quien: string }[];
  areas: { id: string; nombre: string; permisos: Record<RolUsuario, NivelPermiso> }[];
};

export type AuditoriaCategoria = "plata" | "precios" | "stock" | "reglas" | "accesos";

export type AuditoriaEntry = {
  id: string;
  usuarioId: string;
  usuario: string;
  categoria: AuditoriaCategoria;
  accion: string;
  antes?: string;
  despues?: string;
  /** Fecha y hora ISO. */
  en: string;
};

export type InvitacionInput = { email: string; rol: RolUsuario };

/* ---- Preferencias de alertas y cuenta ------------------------------------- */

export type CanalAlerta = "app" | "whatsapp" | "mail";

export type AlertaPreferencia = {
  id: string;
  nombre: string;
  descripcion: string;
  canales: Record<CanalAlerta, boolean>;
};

export type SesionAbierta = {
  id: string;
  dispositivo: string;
  navegador: string;
  ubicacion: string;
  /** Fecha y hora ISO. */
  ultimaActividad: string;
  actual: boolean;
};

export type SeguridadCuenta = {
  dosFactores: boolean;
  /** Fecha y hora ISO. */
  passwordActualizada: string;
};

/* ---- Valores de reglas: texto y validación (los usan el mock y la pantalla) - */

const miles = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const decimal = (value: number) => String(value).replace(".", ",");
/** Coeficientes con 2 a 4 decimales: 1.3 → "1,30", 1.1765 → "1,1765". */
const coeficiente = (value: number) =>
  value
    .toFixed(4)
    .replace(/0{1,2}$/, "")
    .replace(".", ",");

/** Texto de un valor de regla, sin Intl (igual en servidor y navegador): "$ 45.000", "× 1,3". */
export function describirValorRegla(regla: Pick<ReglaNegocio, "tipo" | "unidad" | "opciones">, valor: ReglaValor) {
  if (valor === null || valor === "") return "Sin definir";
  switch (regla.tipo) {
    case "booleano":
      return valor ? "Activada" : "Desactivada";
    case "moneda":
      return `$ ${miles(Number(valor))}`;
    case "porcentaje":
      return `${decimal(Number(valor))} %`;
    case "coeficiente":
      return `× ${coeficiente(Number(valor))}`;
    case "numero":
      return `${miles(Number(valor))}${regla.unidad ? ` ${regla.unidad}` : ""}`;
    case "hora":
      return `${valor} h`;
    case "seleccion":
      return regla.opciones?.find((opcion) => opcion.value === String(valor))?.label ?? String(valor);
    default:
      return String(valor);
  }
}

/** Valor de una regla numérica tal como se muestra en su campo: "2,21", "45.000". */
export function valorParaCampo(tipo: ReglaTipo, valor: ReglaValor) {
  if (valor === null || typeof valor === "boolean") return "";
  if (typeof valor === "string") return valor;
  if (tipo === "coeficiente") return coeficiente(valor);
  if (tipo === "moneda" || tipo === "numero") return miles(valor);
  return decimal(valor);
}

/** Mensaje de error si el valor no es válido para la regla; null si está bien. */
export function validarRegla(
  regla: Pick<ReglaNegocio, "tipo" | "min" | "max" | "aConfirmar" | "opciones">,
  valor: ReglaValor,
) {
  if (valor === null || valor === "") {
    return regla.aConfirmar ? null : "Completá un valor.";
  }
  const numero = typeof valor === "number" ? valor : Number(valor);
  switch (regla.tipo) {
    case "coeficiente":
      if (!Number.isFinite(numero)) return "Tiene que ser un número.";
      if (numero < 1) return "Un coeficiente no puede ser menor a 1: se vendería a pérdida.";
      if (numero > 10) return "Revisá el valor: es más de 10 veces el costo.";
      return null;
    case "porcentaje":
      if (!Number.isFinite(numero) || numero < 0 || numero > 100) return "Tiene que estar entre 0 y 100 %.";
      return null;
    case "moneda":
    case "numero":
      if (!Number.isFinite(numero)) return "Tiene que ser un número.";
      if (regla.min !== undefined && numero < regla.min) return `El mínimo es ${miles(regla.min)}.`;
      if (regla.max !== undefined && numero > regla.max) return `El máximo es ${miles(regla.max)}.`;
      if (numero < 0) return "No puede ser negativo.";
      return null;
    case "hora":
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor)) ? null : "Usá el formato 18:30.";
    case "seleccion":
      return regla.opciones?.some((opcion) => opcion.value === String(valor)) ? null : "Elegí una opción.";
    case "texto":
      return String(valor).trim() ? null : "Completá un valor.";
    default:
      return null;
  }
}

/* ---- Endpoints ------------------------------------------------------------ */

export function plataformaEndpoints(request: ApiRequest) {
  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

  return {
    reglas: {
      list: () => request<ReglaNegocio[]>("/plataforma/reglas"),
      historial: () => request<CambioRegla[]>("/plataforma/reglas/historial"),
      actualizar: (cambios: CambioReglaInput[]) =>
        request<{ reglas: ReglaNegocio[]; cambios: CambioRegla[] }>("/plataforma/reglas", json("PATCH", { cambios })),
    },
    integraciones: {
      list: () => request<Integracion[]>("/plataforma/integraciones"),
      log: () => request<SyncLogEntry[]>("/plataforma/integraciones/log"),
      probar: (id: string) =>
        request<PruebaConexion>(`/plataforma/integraciones/${encodeURIComponent(id)}/probar`, {
          method: "POST",
        }),
      reintentar: (id: string) =>
        request<Integracion>(`/plataforma/integraciones/${encodeURIComponent(id)}/reintentar`, {
          method: "POST",
        }),
      importar: (id: string) =>
        request<{ importados: number }>(`/plataforma/integraciones/${encodeURIComponent(id)}/importar`, {
          method: "POST",
        }),
    },
    ia: {
      config: () => request<IaConfig>("/plataforma/ia"),
      consumo: () => request<IaConsumo>("/plataforma/ia/consumo"),
      actualizar: (cambios: Partial<Pick<IaConfig, "modelo" | "topeMensualUsd" | "alertaPct">>) =>
        request<IaConfig>("/plataforma/ia", json("PATCH", cambios)),
      cargarKey: (input: { tipo: "api" | "admin"; key: string }) =>
        request<CredencialEnmascarada>("/plataforma/ia/keys", json("POST", input)),
    },
    usuarios: {
      list: () => request<UsuarioEquipo[]>("/plataforma/usuarios"),
      roles: () => request<MatrizPermisos>("/plataforma/roles"),
      invitar: (input: InvitacionInput) => request<UsuarioEquipo>("/plataforma/usuarios/invitar", json("POST", input)),
    },
    auditoria: {
      list: (query: { usuario?: string } = {}) =>
        request<AuditoriaEntry[]>(`/plataforma/auditoria${toQueryString(query)}`),
    },
    preferencias: {
      get: () => request<AlertaPreferencia[]>("/plataforma/preferencias"),
      guardar: (preferencias: AlertaPreferencia[]) =>
        request<AlertaPreferencia[]>("/plataforma/preferencias", json("PUT", { preferencias })),
    },
    perfil: {
      seguridad: () => request<SeguridadCuenta>("/plataforma/perfil/seguridad"),
      sesiones: () => request<SesionAbierta[]>("/plataforma/perfil/sesiones"),
      cerrarSesion: (id: string) =>
        request<{ ok: true }>(`/plataforma/perfil/sesiones/${encodeURIComponent(id)}/cerrar`, {
          method: "POST",
        }),
      dosFactores: (activado: boolean) =>
        request<SeguridadCuenta>("/plataforma/perfil/dos-factores", json("PATCH", { activado })),
      cambiarPassword: (input: { actual: string; nueva: string }) =>
        request<SeguridadCuenta>("/plataforma/perfil/password", json("POST", input)),
      actualizarDatos: (input: { nombre: string; telefono: string }) =>
        request<{ ok: true }>("/plataforma/perfil/datos", json("PATCH", input)),
    },
  };
}
