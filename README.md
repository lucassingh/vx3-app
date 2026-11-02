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

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (valida tipos y las reglas de Cache Components) |
| `npm run lint` | ESLint |
| `npm test` | Tests una vez (lo mismo que corre la CI) |
| `npm run test:watch` | Tests en modo watch |

## Datos: API simulada y real

Los componentes nunca llaman a `fetch` directo: usan `api`, tipado con los
contratos de `src/lib/api/contracts/` (uno por módulo).

```tsx
import { api } from "@/lib/api/server";   // Server Components
import { api } from "@/lib/api/browser";  // Client Components
```

`NEXT_PUBLIC_API_MOCK` elige entre la API simulada y la real (reiniciar
`npm run dev` al cambiarla). Hoy pasa toda la app de una vez; en la fase 1.1
pasa a elegirse por dominio, para que DUX sea real mientras el resto sigue
simulado.

La API simulada vive en `src/mocks/`: `seed/` es la semilla compartida (SKUs
reales, clientas, pedidos y anuncios coherentes entre pantallas), `domains/`
arma las respuestas de cada módulo y `db.ts` guarda el estado en memoria hasta
reiniciar el servidor.

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
