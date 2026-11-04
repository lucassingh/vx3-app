# Guía de operación

Qué hacer cuando algo se rompe a las 2 de la mañana. Cada caso dice cómo darse
cuenta, qué hacer y cómo verificar que quedó bien. Los secretos están en
1Password, bóveda **"Cliente · VX3"**; nunca se pegan en un chat ni en un ticket.

| Ambiente   | Web                             | Base (Neon `cli-vx3`) | Se despliega con           |
| ---------- | ------------------------------- | --------------------- | -------------------------- |
| Producción | `https://cli-vx3.vercel.app`    | branch `main`         | un tag `vX.Y.Z` sobre main |
| QA         | `https://cli-vx3-qa.vercel.app` | branch `develop`      | cada push a `develop`      |
| Previews   | la URL que se comenta en la PR  | branch `develop`      | cada PR a `develop`        |

El proyecto `cli-vx3` de Vercel está, por ahora, en la cuenta Hobby de Lucas
(`lucas-singhs-projects`), sin repo conectado. Pasa al Team Pro de la agencia
antes de que VX3 lo use en serio: Hobby es solo para uso no comercial y sus
crons corren una vez por día como mucho.

QA y las previews están detrás de la protección de Vercel: se entra con una
cuenta que tenga acceso al proyecto. Producción es pública (la app pide su
propio login).

## 1. Dónde mirar

| Qué pasó                                    | Dónde                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| La app no responde                          | El monitor de disponibilidad (cuenta de la agencia) y `https://cli-vx3.vercel.app/api/health?base=1`        |
| Un error en una pantalla o una acción       | Sentry, proyecto `cli-vx3`, filtrando por ambiente (`production` o `qa`) y por release (el commit)          |
| Qué hizo el servidor en un request          | Vercel → `cli-vx3` → Logs. Los logs son JSON (pino), sin datos personales                                   |
| Un Cron o un Workflow                       | Vercel → `cli-vx3` → Observability → Cron Jobs y Workflows (cada corrida, paso por paso)                    |
| Un deploy, un backup o una prueba que falló | GitHub → `lucassingh/vx3-app` → Actions. El resumen de cada deploy trae la URL y el momento previo a migrar |
| La base                                     | Neon → `cli-vx3` → Monitoring (conexiones, CPU) y SQL Editor (con el usuario `readonly` para mirar)         |

`/api/health` sin parámetros dice si la web está arriba, con la versión y el
commit. Con `?base=1` además prueba la base y responde 503 si no contesta. El
monitor usa la versión sin base, para que Neon pueda dormirse de noche.

## 2. La web anda mal después de un deploy: volver a la versión anterior

La base no se toca: las migraciones son compatibles hacia atrás
(`tecnica_doc/tecnica.md` §5), así que la versión anterior funciona con el
esquema nuevo.

1. Vercel → `cli-vx3` → Deployments → filtrar por **Production**.
2. En el deploy anterior al que falla: menú **⋯** → **Instant Rollback** → confirmar.
   Por consola: `vercel rollback <url-del-deploy-anterior> --scope <team>`.
3. Verificar: `https://cli-vx3.vercel.app/api/health` muestra el commit anterior.
4. Mientras dure el rollback, Vercel no mueve el dominio con deploys nuevos. Se
   destraba solo con el próximo deploy de producción (el tag siguiente), o a
   mano con **Undo Rollback**.

En QA: correr de nuevo **Deploy QA** sobre el commit bueno (Actions → Deploy QA
→ Run workflow), o revertir el merge en `develop`.

## 3. Restaurar la base a un momento

Para cuando una migración o un proceso dejó datos mal. **Lo escrito después de
ese momento se pierde**: es el último recurso, después de intentar corregir con
una migración nueva.

1. Elegir el momento. Si fue un deploy: Actions → la corrida de **Deploy
   producción** → Summary → "Momento previo a migrar (UTC)".
2. Neon → `cli-vx3` → Branches → `main` → **Restore** → "From history", con ese
   momento (en UTC). Neon guarda el estado anterior como una branch
   `main_old_…`, por si hay que volver atrás.
3. Las conexiones no cambian: la app sigue andando sola, sin redeploy.
4. Verificar: `/api/health?base=1` en verde y entrar a la app.
5. Si el momento elegido era anterior a una migración, la app nueva va a fallar
   contra el esquema viejo: volver también la web (§2).

El historial alcanza hasta donde llega el plan de Neon: unas horas en Free y 7
días en Launch. Más atrás, solo queda el backup semanal (§7).

## 4. Un deploy falló a mitad de camino

Cada deploy hace, en orden: build → momento previo → migraciones → publicar →
prueba de salud. El paso que falló dice qué quedó hecho.

- **Falló el build:** no se migró ni se publicó nada. Corregir y volver a desplegar.
- **Falló la migración:** la web sigue en la versión anterior. Prisma deja la
  migración marcada como fallida en `_prisma_migrations` y no aplica ninguna
  otra hasta resolverla.
  1. Leer el error en el log del paso "Migraciones".
  2. Con la conexión directa del dueño (`PROD_DATABASE_URL_UNPOOLED`, en
     1Password) en `DATABASE_URL_UNPOOLED`, ver qué quedó: `npx prisma migrate status`.
  3. Si la migración no llegó a cambiar nada, o se deshizo a mano lo que cambió:
     `npx prisma migrate resolve --rolled-back <nombre_de_la_migracion>`.
     Si se terminó de aplicar a mano: `npx prisma migrate resolve --applied <nombre>`.
  4. Corregir la migración (si hace falta) en una PR, y desplegar de nuevo.
- **Falló la publicación o la prueba de salud:** la base ya está migrada y la
  web vieja anda con el esquema nuevo. Actions → la corrida → **Re-run failed
  jobs**. Si la prueba de salud sigue fallando con la versión nueva publicada,
  volver la web (§2).

Para desplegar de nuevo el mismo tag: Actions → Deploy producción → la corrida
→ **Re-run all jobs**. No hace falta un tag nuevo.

## 5. Rotar un secreto

Cuando alguien deja el proyecto, se rota en el día todo lo que pudo ver
(`tecnica_doc/infraestructura.md` §11). Después de cambiar una variable de
Vercel hay que desplegar de nuevo para que la tome: QA con Actions → Deploy QA →
Run workflow; producción con Re-run all jobs del último Deploy producción.

| Secreto                               | Dónde vive                                | Cómo se rota                                                                                                                            | Efecto                                       |
| ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `AUTH_SECRET`                         | Vercel (Production y Preview)             | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` → Vercel → Settings → Environment Variables → redeploy | Se cierran todas las sesiones                |
| `CRON_SECRET`                         | Vercel (Production y Preview)             | Igual que `AUTH_SECRET`                                                                                                                 | Ninguno: Vercel Cron toma el nuevo           |
| Contraseña de `app`                   | Vercel `DATABASE_URL`                     | `npm run db:roles -- --branch main --rotar app` → copiar `DATABASE_URL` de `.secrets/neon-main.env` a Vercel → redeploy                 | Hasta el redeploy, la app no entra a la base |
| Contraseña de `readonly`              | GitHub `PROD_DATABASE_URL_READONLY`       | `npm run db:roles -- --branch main --rotar readonly` → actualizar el secret del repo                                                    | Ninguno                                      |
| Contraseña del dueño (`neondb_owner`) | GitHub `QA_`/`PROD_DATABASE_URL_UNPOOLED` | Neon → Branches → la branch → Roles → `neondb_owner` → Reset password → actualizar el secret                                            | Ninguno (solo migra)                         |
| `NEON_API_KEY`                        | GitHub y `.env.local`                     | Neon → Settings del proyecto → API keys → crear una nueva, actualizar, revocar la vieja                                                 | Ninguno                                      |
| `VERCEL_TOKEN`                        | GitHub y `.env.local`                     | Vercel → Account Settings → Tokens (scope: la cuenta del proyecto) → crear, actualizar, borrar el viejo                                 | Ninguno                                      |
| `SENTRY_AUTH_TOKEN`                   | GitHub                                    | Sentry → Settings → Auth Tokens                                                                                                         | Ninguno                                      |
| Claves del bucket (`BACKUP_S3_*`)     | GitHub                                    | Panel del bucket → nuevo par con permiso solo sobre `backups/vx3/` → actualizar → borrar el viejo                                       | Ninguno                                      |
| `BACKUP_PASSPHRASE`                   | GitHub y 1Password                        | Generarla como `AUTH_SECRET` y actualizar el secret                                                                                     | Las copias viejas siguen con la frase vieja  |

**La frase de los backups vieja no se borra de 1Password**: se renombra con
las fechas en que se usó. Sin ella, las copias de esas semanas no se pueden leer.

## 6. Accesos de usuarios de la app

- **Alguien quedó bloqueado por intentos fallidos:** espera a que venza (de 15
  minutos a 24 horas). Para destrabarlo antes, como el dueño de la base:
  `DELETE FROM login_throttles WHERE key = 'user:<email o usuario en minúsculas>';`
- **Se olvidó la contraseña:** un admin la resetea desde Configuración → Usuarios
  (le da una temporal).
- **No queda ningún admin que pueda entrar:** con `DATABASE_URL` de la base en
  `.env.local` (en producción, la de `main`), `npm run auth:create-admin -- --email … --nombre …`.
  Imprime una contraseña temporal una sola vez. Después, volver `.env.local` a
  `develop`.

## 7. Backups

- **Cuándo:** todos los domingos a las 03:00 (`backup.yml`), y a mano desde
  Actions → Backup → Run workflow. Van al bucket de la agencia en
  `backups/vx3/AAAA-MM-DD.sql.gz.gpg`, cifrados; se guardan 90 días.
- **Probar que sirven:** Actions → Prueba de restauración → Run workflow (vacío
  = la última copia). La restaura en una branch efímera, cuenta las filas por
  tabla en el resumen del job y la borra. Se corre una vez por mes, en la rutina.
- **Leer una copia a mano** (necesita la frase de 1Password y gpg):
  ```bash
  gpg --decrypt AAAA-MM-DD.sql.gz.gpg | gunzip > vx3.sql
  ```
  Tiene datos personales de las clientas: se abre solo en una máquina de la
  agencia y se borra al terminar.
- **Volver producción a un backup** (si el historial de Neon ya no alcanza):
  crear en Neon una base vacía, restaurar ahí con `psql --set ON_ERROR_STOP=1 -f vx3.sql "<conexión>"`,
  revisar los datos, y recién entonces decidir si se apunta la app ahí o se
  copian las tablas que hagan falta. Nunca restaurar encima de `main` sin la
  copia del estado actual.

## 8. Procesos en segundo plano

- **El mantenimiento diario** (borra intentos de login y sesiones vencidas)
  corre a las 04:00 de Argentina. Si una corrida falló, se ve en Observability
  → Workflows. Es idempotente: se puede lanzar de nuevo a mano.
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://cli-vx3.vercel.app/api/cron/mantenimiento
  ```
  Responde `{ ok: true, runId }`. Sin el secreto responde 401.
- **Vercel Cron solo corre en producción.** En QA se prueba llamando a la ruta
  como arriba, con el `CRON_SECRET` de Preview.

## 9. Comprobar que Sentry recibe errores

Entrar como admin y abrir `/api/error-de-prueba`: tira un error a propósito. En
un minuto aparece en Sentry con el ambiente, el commit y sin IP, cookies ni
query strings. Si no aparece: la variable `NEXT_PUBLIC_SENTRY_DSN` del ambiente
en Vercel, y que el deploy sea de después de cargarla.

## 10. Checklist de cuentas

Configuración de cuentas, no de código. Se revisa al dar de alta el proyecto y
en la rutina mensual (`tecnica_doc/infraestructura.md` §11 y §12).

- [ ] 2FA en GitHub, Vercel, Neon, Sentry y el bucket, para todas las personas con acceso.
- [ ] Segundo owner en GitHub (o el repo en la org de la agencia), Vercel y Neon.
- [ ] La frase de los backups en 1Password, junto con las viejas.
- [ ] Alertas de Sentry y del monitor al mail de la agencia.
- [ ] Spend Management de Vercel con alerta, y el plan de Neon que corresponde.
- [ ] El último backup existe, pesa lo esperado y la prueba de restauración del mes pasó.

## Variables y secretos de cada lugar

**Vercel** (Settings → Environment Variables):

| Variable                 | Production                   | Preview (QA y previews)        |
| ------------------------ | ---------------------------- | ------------------------------ |
| `DATABASE_URL`           | `app` de `main`, con pooler  | `app` de `develop`, con pooler |
| `AUTH_SECRET`            | propio de producción         | propio de QA                   |
| `BETTER_AUTH_URL`        | `https://cli-vx3.vercel.app` | — (toma la URL de cada deploy) |
| `CRON_SECRET`            | propio de producción         | propio de QA                   |
| `NEXT_PUBLIC_SENTRY_DSN` | el DSN de `cli-vx3`          | el mismo                       |

**GitHub** (Settings → Secrets and variables → Actions, a nivel de repo):
`NEON_API_KEY`, `NEON_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, `QA_DATABASE_URL_UNPOOLED`, `PROD_DATABASE_URL_UNPOOLED`,
`PROD_DATABASE_URL_READONLY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE`,
`SENTRY_AUTH_TOKEN` y `SENTRY_ORG`.
