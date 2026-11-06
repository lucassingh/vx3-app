# Guía de operación

Qué hacer cuando algo se rompe a las 2 de la mañana. Cada caso dice cómo darse
cuenta, qué hacer y cómo verificar que quedó bien. Los secretos están en
`.env.local` y `.secrets/`; nunca se pegan en un chat ni en un ticket.

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
     `.secrets/`) en `DATABASE_URL_UNPOOLED`, ver qué quedó: `npx prisma migrate status`.
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
| `BACKUP_PASSPHRASE`                   | GitHub y `.secrets/`                      | Generarla como `AUTH_SECRET` y actualizar el secret                                                                                     | Las copias viejas siguen con la frase vieja  |

**La clave maestra (`CREDENTIALS_KEY`) no se cambia y listo:** lo que está cifrado con
la vieja deja de leerse. Se sigue el mismo camino que si se perdiera: ver "Si DUX falla",
en el §8.

**La frase de los backups vieja no se borra de `.secrets/`**: se renombra con
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
- **Leer una copia a mano** (necesita la frase de `.secrets/` y gpg):
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
- **La sincronización con DUX** (productos, stock y precios, las ventas de los últimos
  35 días y las clientas) corre a las 05:00 de Argentina y con el botón **Sincronizar
  ahora** de Configuración → Integraciones. Son unos 190 requests y menos de 4 minutos.
  Nunca hay dos a la vez: la segunda avisa y no arranca. La frecuencia se cambia en la
  línea de `/api/cron/dux` en `vercel.json` (y el texto en
  `src/modules/platform/integraciones/estado.ts`). Solo lee: la app no escribe en DUX.
- **La importación del catálogo** corre al terminar cada sincronización con DUX, y con el
  botón **Reimportar** (sección 12).
- **El historial de 12 meses de ventas** se dispara a mano, una vez por ambiente y
  **avisándole antes a Elías**: son unos 150 requests y 15 minutos sobre el límite de la v1
  que comparten sus scripts. Si se corta, volver a llamarlo solo trae los meses que faltan.
  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://cli-vx3.vercel.app/api/cron/dux/historial
  ```
  Responde `{ ok: true, runId }`, o 409 si hay una sincronización en curso.
- **Vercel Cron solo corre en producción.** En QA se prueba llamando a la ruta
  como arriba, con el `CRON_SECRET` de Preview, o con el botón.

### Si DUX falla

La tarjeta de DUX en Configuración → Integraciones dice el estado y el motivo; el registro
de abajo tiene cada corrida. Un fallo de DUX no rompe nada: la app sigue mostrando la
última lectura, y la próxima corrida vuelve a intentar.

| Lo que dice                                            | Qué hacer                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| "DUX rechazó el token"                                 | Sacar uno nuevo en DUX (Configuración → General → Empresa → API) y cargarlo en la tarjeta                        |
| "Todavía no se cargó el token"                         | Cargarlo en la tarjeta                                                                                           |
| "Falta la clave maestra (CREDENTIALS_KEY)"             | Cargar la variable en Vercel y desplegar de nuevo. En una preview es lo esperado: no se conectan a DUX           |
| "Faltan DUX_ID_…"                                      | Cargar la variable en Vercel (ver abajo) y desplegar de nuevo                                                    |
| "Formato desconocido" o "DUX no respondió bien"        | Es pasajero: ya se reintentó solo. Apretar **Reintentar**. Si sigue, DUX está caído: esperar                     |
| "DUX salteó N de M filas al paginar"                   | Faltan esas clientas. Reintentar; si se repite, `/v2/clientes` cambió de comportamiento: revisarlo               |
| "DUX respondió con una forma que no esperábamos en …"  | Cambió la API de DUX. Dice qué campo: ajustar `src/integrations/dux/schemas.ts`. No se guardó nada de esa página |
| "La corrida se cortó antes de terminar"                | Un Workflow murió a la mitad. Reintentar. Mirar Observability → Workflows para saber por qué                     |
| "Ya hay una sincronización en curso", y no hay ninguna | El bloqueo de una corrida que murió vence solo: a los 30 minutos, o a las 2 horas si era el historial            |

**Si se pierde la clave maestra, o hay que cambiarla:** no se pierden datos. Solo está
cifrado el token, y el token se saca de nuevo de DUX.

1. Generar una: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Reemplazar `CREDENTIALS_KEY` en Vercel (y en `.env.local` y `.secrets/`), y desplegar de nuevo.
3. Volver a cargar el token de DUX en la tarjeta. Local y QA comparten la base: alcanza con una vez.
4. **Probar conexión** tiene que responder bien.

**Las clientas fuera de producción están anonimizadas**, y la corrida lo dice en su
detalle. Si en producción aparece "Anonimizadas", el build no recibió
`APP_ENV=production`: ver `.github/actions/deploy`.

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
- [ ] La frase de los backups en `.secrets/`, junto con las viejas.
- [ ] Alertas de Sentry y del monitor al mail de la agencia.
- [ ] Spend Management de Vercel con alerta, y el plan de Neon que corresponde.
- [ ] El último backup existe, pesa lo esperado y la prueba de restauración del mes pasó.

## 11. Clientas: segmentos y lista del día

Las fichas, sus métricas y sus segmentos se recalculan al final de cada sincronización y
del historial, solo desde el espejo: no le piden nada a DUX. Una ficha es un teléfono
normalizado. Sin teléfono no hay ficha, y esa venta queda como no identificada.

**Segmentos.** Se evalúan en este orden, y gana el primero que cumple:

| Segmento  | Cuándo                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| Dormida   | Más de 120 días sin comprar                                                         |
| En riesgo | Más de 60 días, o con 2 compras o más, más de 1,5 veces su ciclo y al menos 30 días |
| Nueva     | Una sola compra, hace 45 días o menos                                               |
| Top       | Está en el 10 % con más margen de los últimos 12 meses                              |
| Activa    | El resto                                                                            |

Una ficha sin compras leídas no tiene segmento. Los comprobantes del mismo día son una
compra, y el ciclo es la mediana de los días entre compras.

**Margen.** Línea por línea, con el costo que DUX congeló en la venta. CF deja el 54,75 % de
la venta, y envío, embalaje y flete dejan 0. Una línea sin costo no suma, y tampoco una con
un costo que llega al precio: es un costo mal cargado, no una pérdida.

**Lista del día.** Hasta 30 por día, por margen de los últimos 12 meses. Los mensajes salen a
los 7, 17, 27 y 37 días de la compra en rotación rápida (ciclo de 20 días o menos), y a los
7, 22, 37 y 52 en la lenta. Nunca más de uno por semana. Si responde, sale de la secuencia;
si vuelve a comprar, arranca de nuevo. Después del último mensaje descansa 45 días y pasa a
la reactivación, que se manda una vez por ciclo. La app no manda nada.

**Dónde se cambian los valores.** Hasta que llegue el editor de reglas (1.10), en código:

| Qué                                               | Dónde                                                          |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Días y porcentajes de los segmentos               | `VALORES_DE_SEGMENTOS`, en `src/modules/customers/metricas.ts` |
| Tope, días de cada mensaje, descanso y alto valor | `VALORES_DE_RECOMPRA`, en `src/modules/customers/secuencia.ts` |
| A qué dormidas les llega la reactivación          | `reactivacionMinimoCompras`, en el mismo lugar                 |
| Textos de los mensajes                            | `PLANTILLAS`, en el mismo archivo                              |
| Cómo se nombra cada rubro en un mensaje           | `RUBRO_EN_MENSAJE`, en el mismo archivo                        |

Un cambio en los segmentos se ve después del deploy y de la sincronización siguiente; uno
en la lista, apenas se despliega.

**Antes de usar la lista en producción:**

1. Correr el historial de 12 meses (sección 8): sin él, casi todas salen como nuevas.
2. Confirmar con Elías que Clara ya no manda nada.
3. Medir cuántas no tienen nombre de pila: sin él, cada mensaje hay que completarlo a mano.
   ```sql
   SELECT count(*) FILTER (WHERE first_name IS NULL) AS sin_nombre, count(*) AS con_compras
   FROM customers WHERE purchases > 0;
   ```

## 12. Catálogo: importar y revisar

Hasta el pase, el catálogo es de consulta: se corrige en el Sheet, Drive y DUX, y la app lo arma
desde ahí (`solucion_doc/06` §6.2). Se puede borrar y reimportar sin perder nada: lo único que no
sale de las fuentes son las decisiones de la revisión (`catalog_decisions`), y cada corrida las
vuelve a aplicar.

**Cuándo se importa.** Al terminar cada sincronización con DUX, si la clave de Google está cargada
en ese ambiente, y con **Reimportar** en Configuración → Integraciones. Son unos 6 pedidos a Google
y unos segundos, salvo que Google se demore. Nunca hay dos a la vez, y dos corridas iguales no
cambian nada. Lee la pestaña `CatalogoDetalle` y la carpeta de fotos: copia las dos fuentes, y
recién después arma el catálogo y la cola, en una sola transacción.

**Si falla, el catálogo anterior queda entero.** La tarjeta de Google dice "Caída" y el motivo:

| Dice                                 | Qué hacer                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Google no respondió                  | Reimportar más tarde. Google tuvo esperas de más de 3 minutos, y la app ya reintenta sola.                                  |
| En el Sheet falta o cambió de nombre | Alguien renombró esa columna. Volver el nombre, o cambiarlo en `COLUMNAS_QUE_SE_LEEN`, en `src/modules/catalog/fuentes.ts`. |
| La carpeta de fotos volvió vacía     | Revisar que la carpeta siga compartida con la cuenta de servicio.                                                           |
| No se pudo leer la credencial        | La clave maestra cambió: cargar de nuevo la clave de Google desde la pantalla.                                              |

Una preview no puede importar: no lee credenciales (`APP_ENV=preview`). Si alguien aprieta el botón
ahí, la tarjeta de QA dice "Caída" hasta la importación siguiente, porque comparten la base.

**Las fotos** las sirve Drive, sin pasar por la app: la carpeta tiene que seguir pública
("cualquiera con el link puede ver"), y **Probar conexión** lo comprueba. Si se cierra, los productos
muestran una miniatura con el código, y Tienda Nube deja de poder subir fotos.

**Estado y prioridad** salen solos de las ventas y el stock, y un agotado o un histórico vuelve solo
a activo cuando entra stock:

| Qué                | Regla                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Activo             | Tiene stock, vendió en los últimos 90 días, o se creó hace menos de 90            |
| Agotado            | Si no: se vendió hace menos de 6 meses, o es de temporada y se vendió en el año   |
| Histórico          | El resto. Sale de la lista y de la revisión, y se encuentra buscándolo            |
| Prioridad A, B y C | A: los que hacen el 80 % de la venta de 90 días. B: lo demás vendido. C: el resto |
| Bulto              | `-12` en medias, `-6` en el resto (`sku_venta`, si está cargado, manda)           |

Los valores se cambian en `src/modules/catalog/salud.ts` (`MESES_PARA_HISTORICO`, `PARETO`,
`RUBROS_DE_TEMPORADA`). Los bloques de la cola, en `src/modules/catalog/revision.ts`.

**Revisión** (Productos → Revisión). Lo corregido en la fuente desaparece en la importación
siguiente. En la app se decide solo lo que el Sheet no puede guardar: de qué producto es una foto
suelta, si se descarta, y los históricos. Cada decisión queda en la auditoría, se aplica enseguida y
se puede deshacer desde la misma pantalla. Las deciden los roles que editan el catálogo.

**En cada ambiente nuevo:**

1. Cargar `GOOGLE_SHEET_ID`, `GOOGLE_FOTOS_CARPETA_ID` y `catalogo` en `API_REAL_DOMAINS`, y desplegar.
2. Cargar la clave de Google desde Integraciones. **Probar conexión** tiene que decir que las fotos
   se ven sin credenciales, y avisa si la cuenta puede editar: tiene que ser lectora.
3. Apretar **Reimportar**.
4. En Revisión, confirmar los históricos: Elías aprobó los 357 el 05/11.

## Variables y secretos de cada lugar

**Vercel** (Settings → Environment Variables):

| Variable                    | Production                   | Preview (QA y previews)        |
| --------------------------- | ---------------------------- | ------------------------------ |
| `DATABASE_URL`              | `app` de `main`, con pooler  | `app` de `develop`, con pooler |
| `AUTH_SECRET`               | propio de producción         | propio de QA                   |
| `BETTER_AUTH_URL`           | `https://cli-vx3.vercel.app` | — (toma la URL de cada deploy) |
| `CRON_SECRET`               | propio de producción         | propio de QA                   |
| `NEXT_PUBLIC_SENTRY_DSN`    | el DSN de `cli-vx3`          | el mismo                       |
| `CREDENTIALS_KEY`           | propia de producción         | la de `.env.local`             |
| `API_REAL_DOMAINS`          | `stock,clientas,catalogo`    | `stock,clientas,catalogo`      |
| `GOOGLE_SHEET_ID`           | el del catálogo              | el mismo                       |
| `GOOGLE_FOTOS_CARPETA_ID`   | la de las fotos              | la misma                       |
| `DUX_ID_EMPRESA`            | `9432`                       | `9432`                         |
| `DUX_ID_SUCURSAL_ECOMMERCE` | `1`                          | `1`                            |
| `DUX_ID_SUCURSAL_LOCAL`     | `2`                          | `2`                            |

Las previews ven las variables de QA, pero ignoran `CREDENTIALS_KEY`: con
`APP_ENV=preview` no se conectan a DUX. El token de DUX no es una variable: está cifrado
en la base de cada ambiente, y se carga desde la pantalla. La clave de Google, igual.

**GitHub** (Settings → Secrets and variables → Actions, a nivel de repo):
`NEON_API_KEY`, `NEON_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, `QA_DATABASE_URL_UNPOOLED`, `PROD_DATABASE_URL_UNPOOLED`,
`PROD_DATABASE_URL_READONLY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE`,
`SENTRY_AUTH_TOKEN` y `SENTRY_ORG`.
