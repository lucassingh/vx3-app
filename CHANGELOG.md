# Cambios

Lo que cambia en cada versión de producción. Cada versión es un tag `vX.Y.Z` sobre
`main` (cómo se despliega: `docs/operacion.md`). El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/).

## [Sin publicar]

Entran los primeros datos reales: la app lee de DUX los productos, el stock, los precios,
las ventas y las clientas, y los guarda en su base. Solo lee: no escribe nada en DUX.

### Stock

- El espejo de stock muestra lo que dice DUX: una fila por producto, con la relación entre
  prendas y bultos ("81 prendas = 13 medias docenas y 3 sueltas") y lo vendido en 30 días.
- Primero aparece lo que necesita atención: un producto agotado que se vende va arriba, y
  uno que nadie compra, al final.
- Margen, compras, proveedores y las diferencias en góndola siguen simulados, y ahora lo
  dicen en pantalla.

### Clientas

- Una ficha por clienta, unida por su teléfono: las fichas de DUX con el mismo número son
  una sola persona, con todas sus compras, y se pueden revisar en "Fichas unificadas".
- Cada ficha muestra sus compras, el total, el margen, qué suele comprar y sus comprobantes.
  Conversaciones, envíos, cobros y reclamos se suman con cada módulo.
- Cinco segmentos: nueva, activa, top, en riesgo y dormida. La pantalla dice qué parte de la
  venta queda sin identificar.
- Recompra del día: hasta 30 clientas por día, primero las de más margen, con el mensaje de
  la secuencia que le toca a cada una. La app no manda nada: se escribe a mano desde WhatsApp.
- Un mensaje solo ofrece lo que tiene un bulto en stock. Sin nombre de pila o sin un dato, no
  se puede mandar hasta completarlo.
- La pantalla cuenta cuántas volvieron a comprar en los 14 días siguientes al mensaje.

### Navegación

- Al pasar entre pantallas de una misma sección, el esqueleto de carga aparece enseguida.

### Integraciones

- Configuración → Integraciones muestra el estado real de DUX, el motivo si algo falla, sus
  números y el registro de cada corrida. Lo que todavía no está conectado aparece como
  pendiente, con la PR en la que entra, y sin datos inventados.
- Un admin carga el token de DUX desde la pantalla: queda cifrado, y nunca vuelve al navegador.
- **Sincronizar ahora** lanza una lectura completa. Nunca hay dos a la vez.

### Sincronización

- Una vez por día en producción: productos, stock y precios, ventas de los últimos 35 días,
  para ver anulaciones y notas de crédito tardías, y clientas.
- El historial de 12 meses de ventas se dispara a mano, y si se corta, retoma.
- Cada sincronización recalcula las fichas, sus métricas y sus segmentos.
- Fuera de producción, las clientas se anonimizan antes de guardarse, y las previews no se
  conectan a DUX.

## [0.1.0] - 2026-11-03

Primera versión en producción: las 25 pantallas de la maqueta, con datos de
demostración, sobre la auth real y la infraestructura de producción. Los datos
reales entran dominio por dominio desde la fase 1.4.

### Pantallas

- Las 25 pantallas de M0 a M12 (Inicio, conversaciones, pedidos, cobros, envíos,
  stock, catálogo, clientas, pauta, bot y configuración) sobre la API simulada,
  con una semilla coherente entre pantallas. La barra lateral avisa que los datos
  son de demostración.

### Usuarios y permisos

- Entrada con email o usuario y contraseña. Sesión de 7 días que se renueva con el
  uso. Quien entra con una contraseña temporal la cambia antes de seguir.
- Cinco intentos fallidos bloquean al usuario (veinte, a la IP), con una espera
  que crece de 15 minutos a 24 horas.
- Seis roles (admin, operaciones, postventa, compras, marketing, solo lectura),
  cada uno con permiso de ver o editar cada área. El menú muestra solo lo que cada
  rol puede ver, y la API, cada pantalla y cada acción lo verifican.
- Configuración → Usuarios: alta con contraseña temporal, cambio de rol, reseteo
  de contraseña, cierre de sesiones, desactivar y reactivar.
- Auditoría de los ingresos, los intentos fallidos, los bloqueos y los cambios de
  usuarios.

### Plataforma

- Next.js 16, PostgreSQL en Neon (São Paulo) con Prisma 7, y funciones en Vercel
  (São Paulo).
- Ambientes de QA, previews por PR y producción, desplegados por GitHub Actions
  con las migraciones aplicadas antes de publicar.
- Tres usuarios de base: el dueño migra, la app no puede tocar el esquema ni
  cambiar la auditoría, y uno de solo lectura para soporte y backups.
- Backup semanal cifrado al bucket de la agencia y prueba de restauración.
- Errores en Sentry sin datos personales, chequeo de salud en `/api/health` y
  aviso si la app se cae.
- Mantenimiento diario con Vercel Cron y un Workflow: borra los intentos de login
  y las sesiones vencidas.

[0.1.0]: https://github.com/lucassingh/vx3-app/releases/tag/v0.1.0
