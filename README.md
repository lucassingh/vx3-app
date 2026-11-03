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
npm run dev
```

Con la API simulada no hace falta ninguna credencial. El login usa el usuario
fijo de `src/lib/session.ts` hasta que entre la auth propia (fase 1.2).

| Script                   | Qué hace                                                                          |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm run dev`            | Servidor de desarrollo                                                            |
| `npm run build`          | Build de producción (valida tipos y las reglas de Cache Components)               |
| `npm run lint`           | ESLint                                                                            |
| `npm run typecheck`      | TypeScript sin emitir                                                             |
| `npm run format`         | Prettier sobre todo el repo (`format:check` solo verifica)                        |
| `npm test`               | Tests una vez (lo mismo que corre la CI)                                          |
| `npm run test:watch`     | Tests en modo watch                                                               |
| `npm run db:migrate:dev` | Crea y aplica una migración en la branch `develop` de Neon (`-- --name <nombre>`) |
| `npm run db:migrate`     | Aplica las migraciones pendientes (lo que corre la CI; nunca genera nada)         |
| `npm run db:seed`        | Datos de referencia, idempotentes                                                 |
| `npm run db:studio`      | Prisma Studio                                                                     |
| `npm run db:dump`        | Copia local de la base con `pg_dump` (en `backups/`)                              |

## Datos: API simulada y real

Los componentes nunca llaman a `fetch` directo: usan `api`, tipado con los
contratos de `src/lib/api/contracts/` (uno por módulo).

```tsx
import { api } from "@/lib/api/server"; // Server Components
import { api } from "@/lib/api/browser"; // Client Components
```

`NEXT_PUBLIC_API_MOCK` elige entre la API simulada y la real (reiniciar
`npm run dev` al cambiarla). Hoy pasa toda la app de una vez; en la fase 1.1
pasa a elegirse por dominio, para que DUX sea real mientras el resto sigue
simulado.

La API simulada vive en `src/mocks/`: `seed/` es la semilla compartida (SKUs
reales, clientas, pedidos y anuncios coherentes entre pantallas), `domains/`
arma las respuestas de cada módulo y `db.ts` guarda el estado en memoria hasta
reiniciar el servidor.

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
├─ lib/api/           contratos, endpoints y clientes (server / browser)
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
