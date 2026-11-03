# VX3 app

App de gestión de VX3, mayorista de lencería y blanco. Concentra en un solo
lugar el catálogo, las conversaciones, los pedidos, los envíos, los cobros, la
post-venta, la pauta y el stock, con DUX por detrás como ERP fiscal y de stock.
La desarrolla Más Uno.

**Estado:** las 25 pantallas de los módulos M0 a M12 andan sobre una API
simulada. Las integraciones reales (DUX, Meta, WhatsApp, Correo, Zupply, bancos)
entran dominio por dominio, una fase por PR, sin tocar las pantallas.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript ·
Tailwind CSS 4 · Radix UI · Motion · Lucide · Vitest + Testing Library.

## Arrancar

```bash
npm install
cp .env.example .env.local   # completar los valores: cada variable dice de dónde sale
npm run db:migrate            # aplica las migraciones en tu base
npm run auth:create-admin     # tu usuario admin, con una contraseña temporal
npm run dev
```

No hay registro público: el primer admin de cada base se crea con
`npm run auth:create-admin` y los demás usuarios, desde Configuración → Usuarios y
roles. Con la API simulada no hace falta ninguna otra credencial.

| Script                      | Qué hace                                                                          |
| --------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`               | Servidor de desarrollo                                                            |
| `npm run build`             | Build de producción (valida tipos y las reglas de Cache Components)               |
| `npm run lint`              | ESLint                                                                            |
| `npm run typecheck`         | TypeScript sin emitir                                                             |
| `npm run format`            | Prettier sobre todo el repo (`format:check` solo verifica)                        |
| `npm test`                  | Tests unitarios y de componentes, una vez                                         |
| `npm run test:watch`        | Los mismos, en modo watch                                                         |
| `npm run test:coverage`     | Los mismos, con cobertura y sus umbrales (`vitest.config.mts`)                    |
| `npm run test:int`          | Tests de integración en una branch efímera de Neon que se crea y se borra         |
| `npm run db:migrate:dev`    | Crea y aplica una migración en la branch `develop` de Neon (`-- --name <nombre>`) |
| `npm run db:migrate`        | Aplica las migraciones pendientes (lo que corre la CI; nunca genera nada)         |
| `npm run db:seed`           | Datos de referencia, idempotentes                                                 |
| `npm run db:studio`         | Prisma Studio                                                                     |
| `npm run db:dump`           | Copia local de la base con `pg_dump` (en `backups/`)                              |
| `npm run auth:create-admin` | Crea un admin con contraseña temporal (el primero de cada base)                   |

## Datos: API simulada y real

Los componentes nunca llaman a `fetch` directo: usan `api`, tipado con los
contratos de `src/lib/api/contracts/` (uno por módulo).

```tsx
import { api } from "@/lib/api/server"; // Server Components
import { api } from "@/lib/api/browser"; // Client Components
```

Cada dominio (un módulo: `cobros`, `stock`, `catalogo`…) es simulado o real por
separado. `API_REAL_DOMAINS` lista los reales, separados por coma; el resto usa la
API simulada. Todo pasa por el endpoint único `/api/v1/*` de la app, que pide sesión
y decide en el servidor (`src/lib/api/dispatch.ts`). Las implementaciones reales van
en `src/lib/api/real-routes.ts`, con el mismo contrato que su mock.

La API simulada vive en `src/mocks/`: `seed/` es la semilla compartida (SKUs
reales, clientas, pedidos y anuncios coherentes entre pantallas), `domains/`
arma las respuestas de cada módulo y `db.ts` guarda el estado en memoria hasta
reiniciar el servidor.

## Usuarios, sesiones y permisos

Auth propia con Better Auth (fijado en la 1.7.12), con los usuarios en nuestra base
(`src/modules/platform/auth/`). Se entra con email o usuario; sesión de 7 días que se
renueva con el uso; quien entra con una contraseña temporal la cambia antes de seguir.
Cinco intentos fallidos bloquean al usuario (veinte, a la IP) con una espera que crece.
Better Auth no tiene ruta HTTP: todo pasa por nuestras Server Actions.

- **Roles y matriz:** `src/modules/platform/permissions.ts` es la fuente de verdad. Cada
  área tiene permiso de ver y de editar (`pedidos.ver`, `pedidos.editar`).
- **Qué área es cada pantalla y cada ruta de la API:** `src/modules/platform/access.ts`.
- **Dónde se verifica:** el proxy solo mira que haya cookie. La verificación real está en
  `requirePageAccess(href)`, primera línea de cada pantalla (un test lo exige); en el
  despachador de la API (401 sin sesión, 403 sin permiso), y en cada Server Action vía
  `defineAction({ permission })`.
- **Auditoría:** el `audit()` que `defineAction` le da a cada acción escribe en
  `audit_logs` quién hizo qué, con el antes y el después, sin contraseñas ni tokens.

## Base de datos

PostgreSQL en Neon (proyecto `cli-vx3`), con Prisma 7 fijado en la 7.10.1. La app usa
la conexión con pooler (`DATABASE_URL`, en `src/db/client.ts`) y las migraciones la
directa (`DATABASE_URL_UNPOOLED`, en `prisma.config.ts`). El esquema está en
`prisma/schema.prisma`; el cliente se genera solo al instalar (`src/generated/`, fuera de
git). Los IDs son uuid v7 generados en la app (`newId()` de `src/db/ids.ts`).

## Estructura

```
src/
├─ app/(dashboard)/   una carpeta por pantalla
├─ components/
│  ├─ <dominio>/      componentes de cada módulo (pedidos, cobros, pauta…)
│  ├─ kit/            bloques de pantalla (KPIs, barras, gráfico, embudo…)
│  ├─ ui/             primitivas (Button, Card, Table, Badge, Input…)
│  └─ layout/         aside, navbar, breadcrumb, PageHeader/PageBody
├─ config/            marca y navegación
├─ lib/               piezas base (errores, Money, fechas, logger, defineAction)
├─ lib/api/           contratos, endpoints y clientes (server / browser)
├─ modules/           lógica real por módulo (platform: auth, permisos, usuarios, auditoría)
└─ mocks/             semilla, base en memoria y rutas de la API simulada
```

## Cómo se trabaja

- **Branches:** `main` es producción, `develop` es QA y cada fase de
  implementación va en `phase/<N.M>-<slug>`, que nace de `develop`.
- **Commits:** Conventional Commits en inglés, uno por ítem de la fase.
- **PR:** de la fase hacia `develop`, con la descripción en español y la CI en
  verde. Merge commit, sin squash.

Las convenciones de código (tokens de color, skeletons, toasts, tests) están en
`CLAUDE.md`.
