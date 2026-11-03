import type { AppError, AppErrorCode, FieldErrors } from "./errors";

/**
 * Resultado de una Server Action: o los datos o un error que la UI puede
 * mostrar. Es un objeto plano para que viaje del servidor al navegador; las
 * clases de error no sobreviven ese viaje.
 */
export type Result<T, E = ActionError> = { ok: true; data: T } | { ok: false; error: E };

export type ActionError = {
  code: AppErrorCode;
  message: string;
  /** Solo en VALIDATION: qué está mal en cada campo del formulario. */
  fieldErrors?: FieldErrors;
  /** Solo en INTERNAL: para buscar el error en los logs. */
  requestId?: string;
};

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function toActionError(error: AppError): ActionError {
  const actionError: ActionError = { code: error.code, message: error.message };
  if ("fieldErrors" in error) actionError.fieldErrors = error.fieldErrors as FieldErrors;
  return actionError;
}
