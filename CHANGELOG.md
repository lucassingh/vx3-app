# Cambios

Lo que cambia en cada versión de producción. Cada versión es un tag `vX.Y.Z` sobre
`main` (cómo se despliega: `docs/operacion.md`). El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/).

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
