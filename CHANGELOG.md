# Cambios

Lo que cambia en cada versión de producción. Cada versión es un tag `vX.Y.Z` sobre
`main` (cómo se despliega: `docs/operacion.md`). El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/).

## [Sin publicar]

Entran los primeros datos reales: la app lee de DUX los productos, el stock, los precios,
las ventas y las clientas, arma el catálogo con el Sheet y las fotos de Drive, y guarda todo
en su base. Del Sheet y Drive solo lee. En DUX y en Tienda Nube escribe una sola cosa, y solo en
producción: los productos nuevos que se publican desde el alta, y lo que se edita después del corte.

### Alta y publicación

- El alta de producto corre sobre datos reales: rubros, subrubros y proveedores salen de DUX, y el
  SKU sugerido cuenta los códigos inhabilitados y vendidos.
- Antes de crear, muestra lo parecido del catálogo, con los históricos, y lleva a su ficha.
- Los borradores quedan guardados, y son de todo el equipo.
- Las fotos suben directo a un almacenamiento propio, con orden y foto principal.
- Publicar en DUX crea un código por vez. Si se corta, retoma sin duplicar. Si la API no
  responde, baja los tres `.xls`, iguales a los del Hub.
- Publicar en Tienda Nube crea el producto oculto, y lo muestra recién con precio y foto. Nunca
  crea una categoría: si falta, frena y lo dice.
- El control final vuelve al catálogo, con seis chequeos sobre lo leído de DUX y de la tienda. La
  ficha dice si el producto está publicado, pausado o no está en la tienda.
- Un botón hace el corte: la última importación y, desde ahí, se edita la ficha en la app. Se puede
  volver atrás.
- La tarjeta de Tienda Nube en Integraciones es real, y la tienda se lee cada noche.
- Fuera de producción no se escribe nada en la tienda, y en DUX solo con su conjunto de datos de
  prueba: las pantallas lo dicen.

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

### Catálogo

- El catálogo se arma solo desde el Sheet, Drive y DUX, cada vez que se sincroniza con DUX y
  con un botón. Hasta el pase es de consulta: los datos se siguen corrigiendo en cada fuente.
- Buscador con fotos y filtros por rubro, subrubro, marca, tela, talle, color, último proveedor
  y estado. Primero aparecen los más vendidos.
- Cada producto dice si está activo, agotado o es histórico, si es de temporada, qué le falta
  para venderse y dónde se corrige.
- Los históricos salen de la lista, pero se encuentran al buscarlos. Si vuelven a tener stock,
  vuelven solos como activos.
- Revisión: una sola lista de lo que hay que corregir, por ventas, que se vacía sola con cada
  importación. En la app se decide solo lo que el Sheet no puede guardar: de qué producto es una
  foto suelta, y los históricos, que se confirman en bloque.
- El alta de producto y los combos siguen simulados, y ahora lo dicen en pantalla.

### Navegación

- Al pasar entre pantallas de una misma sección, el esqueleto de carga aparece enseguida.

### Integraciones

- Configuración → Integraciones muestra el estado real de DUX, el motivo si algo falla, sus
  números y el registro de cada corrida. Lo que todavía no está conectado aparece como
  pendiente, con la PR en la que entra, y sin datos inventados.
- Un admin carga el token de DUX desde la pantalla: queda cifrado, y nunca vuelve al navegador.
- **Sincronizar ahora** lanza una lectura completa. Nunca hay dos a la vez.
- Google tiene su tarjeta real, con **Reimportar**. Si una lectura falla o cambia una columna del
  Sheet, dice el motivo y el catálogo anterior queda entero.

### Sincronización

- Una vez por día en producción: productos, stock y precios, ventas de los últimos 35 días,
  para ver anulaciones y notas de crédito tardías, y clientas.
- El historial de 12 meses de ventas se dispara a mano, y si se corta, retoma.
- Cada sincronización recalcula las fichas, sus métricas y sus segmentos, y al terminar importa
  el catálogo, si la clave de Google está cargada.
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
