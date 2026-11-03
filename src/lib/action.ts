import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { newId } from "@/db/ids";
import { ForbiddenError, isAppError, UnauthenticatedError, ValidationError } from "./errors";
import { type Logger, logger } from "./logger";
import { type AuditEntry, record as recordAudit } from "@/modules/platform/audit/service";
import { getSessionUser, type SessionUser } from "@/modules/platform/auth/session";
import { can, type Permission } from "@/modules/platform/permissions";
import { fail, ok, type Result, toActionError } from "./result";

/**
 * Toda Server Action pasa por acá. Una Server Action es un endpoint público:
 * cualquiera puede llamarla con lo que quiera, así que defineAction
 *   1. verifica la sesión y el permiso,
 *   2. valida la entrada con Zod (el handler recibe los datos ya parseados),
 *   3. ejecuta el handler con el usuario, el ID del request, un logger y
 *      `audit()`, que deja el cambio en el registro de auditoría con quién lo hizo,
 *   4. traduce el resultado: los AppError llegan a la UI con su mensaje; lo
 *      inesperado se registra completo y la UI recibe un mensaje genérico con
 *      el ID para buscarlo en los logs.
 *
 *   export const archivarProducto = defineAction({
 *     name: "catalogo.archivar",
 *     input: z.object({ sku: z.string() }),
 *     permission: "catalogo.editar",
 *     handler: async ({ sku }, { user }) => catalogo.archivar(sku, user),
 *   });
 */

export type ActionContext = {
  user: SessionUser;
  requestId: string;
  log: Logger;
  /** Registra el cambio en la auditoría, a nombre del usuario y con el ID del request. */
  audit: (entry: Omit<AuditEntry, "actor" | "requestId">) => Promise<void>;
};

export type ActionDefinition<Schema extends z.ZodType, Output> = {
  /** Para los logs: "dominio.accion". */
  name: string;
  input: Schema;
  /** null: cualquier usuario con sesión (cambiar su contraseña, sus preferencias). */
  permission: Permission | null;
  handler: (input: z.output<Schema>, context: ActionContext) => Promise<Output>;
};

export function defineAction<Schema extends z.ZodType, Output>({
  name,
  input,
  permission,
  handler,
}: ActionDefinition<Schema, Output>) {
  return async (raw: z.input<Schema>): Promise<Result<Output>> => {
    const requestId = newId();
    const log = logger.child({ action: name, requestId });
    const startedAt = performance.now();
    const ms = () => Math.round(performance.now() - startedAt);

    try {
      const user = await getSessionUser();
      if (!user) throw new UnauthenticatedError();
      if (permission && !can(user.role, permission)) throw new ForbiddenError();

      const parsed = input.safeParse(raw);
      if (!parsed.success) {
        throw new ValidationError(
          "Revisá los datos: hay campos con errores.",
          z.flattenError(parsed.error).fieldErrors,
        );
      }

      const audit = (entry: Omit<AuditEntry, "actor" | "requestId">) =>
        recordAudit({ ...entry, actor: { id: user.id, label: user.name }, requestId });
      const data = await handler(parsed.data, { user, requestId, log, audit });
      log.info({ ms: ms() }, "acción completada");
      return ok(data);
    } catch (error) {
      // redirect() y notFound() de Next se lanzan como errores: tienen que seguir de largo.
      unstable_rethrow(error);
      if (isAppError(error)) {
        log.warn({ code: error.code, ms: ms() }, error.message);
        return fail(toActionError(error));
      }
      log.error({ err: error, ms: ms() }, "error inesperado en la acción");
      return fail({
        code: "INTERNAL",
        message: `Algo falló de nuestro lado. Probá de nuevo y, si sigue, pasanos este código: ${requestId.slice(-8)}.`,
        requestId,
      });
    }
  };
}
