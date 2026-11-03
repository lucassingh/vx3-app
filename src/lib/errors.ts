/**
 * Errores de dominio. El mensaje es para la persona que usa la app: en
 * castellano, dice qué pasó y qué hacer, y la UI lo muestra tal cual en un
 * toast. Nunca lleva datos personales ni secretos, porque también va al log.
 *
 * Lo que no es un AppError es un error inesperado: defineAction lo registra
 * completo y a la UI le llega un mensaje genérico con el ID del request.
 */

export type AppErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "EXTERNAL_SERVICE" | "INTERNAL";

/** Código HTTP de cada error, para las rutas de la API. */
export const HTTP_STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  EXTERNAL_SERVICE: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }

  get status() {
    return HTTP_STATUS[this.code];
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "La sesión venció: volvé a entrar.") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tenés permiso para hacer esto. Si lo necesitás, pedíselo a un administrador.") {
    super("FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message);
  }
}

/** Errores por campo, con el nombre del campo como clave (lo que devuelve z.flattenError). */
export type FieldErrors = Record<string, string[] | undefined>;

export class ValidationError extends AppError {
  readonly fieldErrors: FieldErrors;

  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super("VALIDATION", message);
    this.fieldErrors = fieldErrors;
  }
}

/** La operación choca con el estado actual: un SKU que ya existe, un pedido ya facturado. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

/** DUX, Meta, Zupply, un banco… no respondió o respondió mal. */
export class ExternalServiceError extends AppError {
  readonly service: string;

  constructor(service: string, message: string, options?: ErrorOptions) {
    super("EXTERNAL_SERVICE", message, options);
    this.service = service;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
