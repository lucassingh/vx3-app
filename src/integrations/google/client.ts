import "server-only";
import { sign } from "node:crypto";
import { z } from "zod";
import { ExternalServiceError } from "@/lib/errors";
import { createHttpClient, type HttpClientOptions, type RespuestaHttp, type Veredicto } from "@/lib/http-client";
import type { CuentaDeServicio } from "./cuenta";

/**
 * Adaptador de Sheets y Drive (`solucion_doc/06` §6.2). Solo lee: los permisos del token
 * no dejan escribir, y la cuenta entra como lectora. Después del pase, el Sheet y la
 * carpeta quedan de solo lectura y esto deja de usarse.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");
const URL_SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const URL_DRIVE = "https://www.googleapis.com/drive/v3/files";
const MIME_CARPETA = "application/vnd.google-apps.folder";
const SERVICIO = "Google";

/** El Sheet llegó a tardar más de 3 minutos en responder 503, y minutos después andaba. */
const ESPERAS_MS = [5_000, 15_000, 30_000];
const TIMEOUT_MS = 120_000;

type Dependencias = Pick<HttpClientOptions, "fetch" | "esperar" | "log" | "alIntentar" | "esperasMs" | "timeoutMs">;

const errorDeGoogleSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

export function clasificarRespuestaGoogle({ status, cuerpo }: RespuestaHttp): Veredicto {
  if (status >= 200 && status < 300) return { tipo: "ok" };
  const { error } = errorDeGoogleSchema.safeParse(cuerpo).data ?? {};
  const motivo = error?.message ?? `HTTP ${status}`;
  const razon = error?.errors?.[0]?.reason ?? "";
  if (status === 429 || status >= 500 || (status === 403 && /rateLimit/i.test(razon))) {
    return { tipo: "reintentar", motivo };
  }
  // Drive responde 404 tanto si no existe como si no está compartido con la cuenta.
  if (status === 404)
    return { tipo: "error", mensaje: "Google no lo encuentra: no está compartido con la cuenta, o el ID está mal." };
  return { tipo: "error", mensaje: `Google respondió: ${motivo}` };
}

const b64 = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");

/** Cambia la clave por un token de acceso de una hora (JWT firmado, el flujo de las cuentas de servicio). */
export async function pedirTokenDeGoogle(
  cuenta: CuentaDeServicio,
  {
    fetch: fetchHttp = globalThis.fetch,
    ahora = () => Date.now(),
  }: { fetch?: typeof globalThis.fetch; ahora?: () => number } = {},
): Promise<string> {
  const iat = Math.floor(ahora() / 1000);
  const sinFirma = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: cuenta.client_email,
    scope: SCOPES,
    aud: cuenta.token_uri,
    iat,
    exp: iat + 3600,
  })}`;

  let firma: string;
  try {
    firma = sign("RSA-SHA256", Buffer.from(sinFirma), cuenta.private_key).toString("base64url");
  } catch {
    throw new ExternalServiceError(SERVICIO, "La clave de la cuenta de servicio no es válida: cargala de nuevo.");
  }

  let respuesta: Response;
  try {
    respuesta = await fetchHttp(cuenta.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${sinFirma}.${firma}`,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ExternalServiceError(SERVICIO, "Google no respondió al pedir el acceso. Probá de nuevo en un rato.");
  }
  const cuerpo = (await respuesta.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!respuesta.ok || !cuerpo.access_token) {
    throw new ExternalServiceError(
      SERVICIO,
      `Google no aceptó la clave de la cuenta de servicio${cuerpo.error_description ? `: ${cuerpo.error_description}` : "."}`,
    );
  }
  return cuerpo.access_token;
}

function validar<S extends z.ZodType>(esquema: S, cuerpo: unknown, donde: string): z.output<S> {
  const resultado = esquema.safeParse(cuerpo);
  if (resultado.success) return resultado.data;
  throw new ExternalServiceError(SERVICIO, `Google respondió con una forma que no esperábamos en ${donde}.`);
}

const metadatosSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.string().optional(),
  capabilities: z.object({ canEdit: z.boolean().optional() }).optional(),
});

const planillaSchema = z.object({
  sheets: z.array(z.object({ properties: z.object({ title: z.string() }) })),
});

const valoresSchema = z.object({
  valueRanges: z.array(z.object({ values: z.array(z.array(z.unknown())).optional() })),
});

const archivoSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.string().optional(),
  md5Checksum: z.string().optional(),
  createdTime: z.string().optional(),
  modifiedTime: z.string().optional(),
  imageMediaMetadata: z.object({ width: z.number().optional(), height: z.number().optional() }).optional(),
});

const paginaDeCarpetaSchema = z.object({
  nextPageToken: z.string().optional(),
  files: z.array(archivoSchema).optional(),
});

export type MetadatosDeGoogle = { nombre: string; mimeType: string; modificado: string | null; puedeEditar: boolean };

/** Cada pestaña con dos lecturas: lo que ve el equipo y el valor crudo (un "1,5" escrito como texto se nota acá). */
export type PestanaDelSheet = { titulo: string; visto: string[][]; crudo: unknown[][] };

export type ArchivoDeDrive = {
  id: string;
  nombre: string;
  mimeType: string;
  bytes: number | null;
  md5: string | null;
  creado: string | null;
  modificado: string | null;
  ancho: number | null;
  alto: number | null;
  /** "Repositorio Fotos/Mallas": la carpeta donde está. */
  ruta: string;
};

const aParametros = (parametros: Record<string, string>) => new URLSearchParams(parametros).toString();

export function createGoogleClient(token: string, dependencias: Dependencias = {}) {
  const fetchHttp = dependencias.fetch ?? globalThis.fetch;
  const comun = {
    servicio: SERVICIO,
    headers: { Authorization: `Bearer ${token}` },
    clasificar: clasificarRespuestaGoogle,
    esperasMs: ESPERAS_MS,
    timeoutMs: TIMEOUT_MS,
    ...dependencias,
  };
  const sheets = createHttpClient({ ...comun, baseUrl: URL_SHEETS });
  const drive = createHttpClient({ ...comun, baseUrl: URL_DRIVE });

  const listar = async (parametros: Record<string, string>) => {
    const { cuerpo } = await drive.get(
      `?${aParametros({ supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...parametros })}`,
    );
    return validar(paginaDeCarpetaSchema, cuerpo, "la carpeta");
  };

  return {
    /** Si la cuenta llega al archivo, y con qué permiso. */
    async verificar(id: string): Promise<MetadatosDeGoogle> {
      const { cuerpo } = await drive.get(
        `/${id}?${aParametros({ fields: "name,mimeType,modifiedTime,capabilities(canEdit)", supportsAllDrives: "true" })}`,
      );
      const datos = validar(metadatosSchema, cuerpo, "el archivo");
      return {
        nombre: datos.name,
        mimeType: datos.mimeType,
        modificado: datos.modifiedTime ?? null,
        puedeEditar: datos.capabilities?.canEdit ?? false,
      };
    },

    /** Todas las pestañas de una vez: en dos pedidos, y no uno por pestaña. */
    async leerPlanilla(id: string): Promise<PestanaDelSheet[]> {
      const { cuerpo: meta } = await sheets.get(`/${id}?${aParametros({ fields: "sheets(properties(title))" })}`);
      const titulos = validar(planillaSchema, meta, "la planilla").sheets.map(({ properties }) => properties.title);
      const rangos = titulos
        .map((titulo) => `ranges=${encodeURIComponent(`'${titulo.replaceAll("'", "''")}'`)}`)
        .join("&");
      const leer = async (valueRenderOption: string) => {
        const { cuerpo } = await sheets.get(
          `/${id}/values:batchGet?${rangos}&${aParametros({ valueRenderOption, dateTimeRenderOption: "FORMATTED_STRING" })}`,
        );
        return validar(valoresSchema, cuerpo, "los valores").valueRanges;
      };
      const visto = await leer("FORMATTED_VALUE");
      const crudo = await leer("UNFORMATTED_VALUE");
      return titulos.map((titulo, indice) => ({
        titulo,
        visto: (visto[indice]?.values ?? []).map((fila) => fila.map((valor) => String(valor ?? ""))),
        crudo: crudo[indice]?.values ?? [],
      }));
    },

    /** Recorre la carpeta y sus subcarpetas. No baja las fotos: solo los datos de cada archivo. */
    async leerCarpeta(id: string, nombre: string): Promise<ArchivoDeDrive[]> {
      const archivos: ArchivoDeDrive[] = [];
      const pendientes = [{ id, ruta: nombre }];
      for (let carpeta = pendientes.shift(); carpeta; carpeta = pendientes.shift()) {
        let pageToken: string | undefined;
        do {
          const pagina = await listar({
            q: `'${carpeta.id}' in parents and trashed = false`,
            pageSize: "1000",
            fields:
              "nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime,modifiedTime,imageMediaMetadata(width,height))",
            ...(pageToken ? { pageToken } : {}),
          });
          for (const archivo of pagina.files ?? []) {
            if (archivo.mimeType === MIME_CARPETA) {
              pendientes.push({ id: archivo.id, ruta: `${carpeta.ruta}/${archivo.name}` });
              continue;
            }
            archivos.push({
              id: archivo.id,
              nombre: archivo.name,
              mimeType: archivo.mimeType,
              bytes: archivo.size ? Number(archivo.size) : null,
              md5: archivo.md5Checksum ?? null,
              creado: archivo.createdTime ?? null,
              modificado: archivo.modifiedTime ?? null,
              ancho: archivo.imageMediaMetadata?.width ?? null,
              alto: archivo.imageMediaMetadata?.height ?? null,
              ruta: carpeta.ruta,
            });
          }
          pageToken = pagina.nextPageToken;
        } while (pageToken);
      }
      return archivos;
    },

    /** Una foto cualquiera de la carpeta, para comprobar cómo se ven. */
    async unaFoto(carpetaId: string): Promise<string | null> {
      const pagina = await listar({
        q: `'${carpetaId}' in parents and mimeType contains 'image/' and trashed = false`,
        pageSize: "1",
        fields: "files(id,name,mimeType)",
      });
      return pagina.files?.[0]?.id ?? null;
    },

    /** Si una foto se ve sin credenciales. Va sin el token, como la pide el navegador de cualquiera. */
    async fotoEsPublica(id: string): Promise<boolean> {
      try {
        const respuesta = await fetchHttp(urlDeMiniatura(id), { signal: AbortSignal.timeout(20_000) });
        return respuesta.ok && (respuesta.headers.get("content-type") ?? "").startsWith("image/");
      } catch {
        return false;
      }
    },
  };
}

export function urlDeMiniatura(id: string, ancho = 400): string {
  return `https://drive.google.com/thumbnail?${aParametros({ id, sz: `w${ancho}` })}`;
}
