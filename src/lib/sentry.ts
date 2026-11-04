import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Opciones de Sentry, iguales en el servidor (instrumentation.ts) y en el
 * navegador (instrumentation-client.ts). Manda solo los errores de QA y de
 * producción, con el commit como release, y nunca datos personales: ni IP, ni
 * cookies, ni cuerpos, ni headers salvo los inofensivos, ni query strings (una
 * búsqueda puede llevar un teléfono o un DNI).
 */

const AMBIENTES_CON_SENTRY = new Set(["qa", "production"]);
const HEADERS_PERMITIDOS = new Set(["user-agent", "content-type", "accept-language"]);

function sinQuery<T extends string | undefined>(url: T): T {
  if (!url) return url;
  const corte = url.search(/[?#]/);
  return (corte === -1 ? url : url.slice(0, corte)) as T;
}

export function limpiarBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Lo que pasa por la consola puede traer cualquier dato.
  if (breadcrumb.category === "console") return null;
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  for (const clave of ["url", "from", "to"]) {
    if (typeof data[clave] === "string") data[clave] = sinQuery(data[clave]);
  }
  return { ...breadcrumb, data };
}

export function limpiarEvento(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const { url, method, headers } = event.request;
    event.request = {
      url: sinQuery(url),
      method,
      headers: headers
        ? Object.fromEntries(Object.entries(headers).filter(([clave]) => HEADERS_PERMITIDOS.has(clave.toLowerCase())))
        : undefined,
    };
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(limpiarBreadcrumb).filter((breadcrumb) => breadcrumb !== null);
  }
  return event;
}

export function opcionesDeSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.APP_ENV ?? "local";
  return {
    dsn,
    environment,
    release: process.env.APP_COMMIT,
    enabled: Boolean(dsn) && AMBIENTES_CON_SENTRY.has(environment),
    sendDefaultPii: false,
    // Solo errores: el rendimiento se mira en Vercel Observability.
    tracesSampleRate: 0,
    beforeSend: limpiarEvento,
    beforeBreadcrumb: limpiarBreadcrumb,
  };
}
