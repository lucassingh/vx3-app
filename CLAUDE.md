@AGENTS.md

# VX3 app

App de gestión de VX3, construida sobre el starter de dashboard de Más Uno
(Next 16 · React 19 · Tailwind 4 · TypeScript). Marca y navegación viven en
`src/config/`; el resto es contenido del negocio, un dominio por módulo.

## Adaptar a un cliente nuevo

Todo lo de marca vive en `src/config/`. Orden recomendado:

1. **Colores**: `src/config/theme.css`. Cambiar `--primary`, `--secondary`,
   `--accent` y sus `*-foreground` en el bloque claro y en `[data-theme="dark"]`.
   - Cada `*-foreground` debe tener contraste ≥ 4.5:1 sobre su color.
   - En oscuro, usar una versión más clara del color de marca con texto oscuro encima.
   - Superficies (`--canvas` #f3f3f5, `--surface` blanco) y bordes solo se tocan si el cliente lo pide.
2. **Identidad**: `src/config/site.ts` (name, tagline, logo, locale, version,
   defaultTheme). El logo va en `/public` y se referencia como `"/logo.svg"`.
   Reemplazar también `src/app/icon.svg` (favicon).
3. **Navegación**: `src/config/navigation.ts`. Secciones → items → subitems.
   Un item con `items` es un grupo desplegable y no lleva `href`.
4. **Pantallas**: cada `href` necesita `src/app/(dashboard)/<href>/page.tsx`.
   Para una pantalla todavía vacía usar el placeholder:
   ```tsx
   import { PlaceholderView } from "@/components/views/placeholder-view";
   import { getRouteMetadata } from "@/lib/navigation";

   export const metadata = getRouteMetadata("/mi-ruta");

   export default function Page() {
     return <PlaceholderView href="/mi-ruta" />;
   }
   ```
   Borrar las carpetas de rutas que ya no estén en la navegación.
5. **Tipografía** (opcional): `src/config/fonts.ts`.
6. Correr `npm test`: `navigation.test.ts` falla si algún `href` no tiene su `page.tsx`.

## VX3: módulos

La navegación sigue los módulos de `solucion_doc/05`: M10 Inicio · M11
Conversaciones · M12 Clientas · M9 Pauta · M3 Bot · M4 Vidriera · M5 Pedidos ·
M6 Envíos · M7 Cobros · M8 Post-venta · M1 Productos · M2 Stock y compras ·
M0 Configuración. Cada módulo es un **dominio** con los mismos archivos:

| Qué                              | Dónde                                                    |
| -------------------------------- | -------------------------------------------------------- |
| Tipos y endpoints                | `src/lib/api/contracts/<dominio>.ts`                     |
| Rutas y datos de la API simulada | `src/mocks/domains/<dominio>.ts` (+ `<dominio>.test.ts`) |
| Componentes                      | `src/components/<dominio>/`                              |
| Pantallas                        | `src/app/(dashboard)/<ruta>/page.tsx`                    |

Lo compartido: tipos de negocio en `src/lib/api/types.ts` (canal, estado del
pedido, zona…), sus etiquetas y badges en `src/lib/domain.ts`, y los bloques
de pantalla en `src/components/kit/` (`KpiGrid`, `BarList`, `ColumnChart`,
`Funnel`, `Meter`, `ProductThumb`, `UrlSearch`, badges de estado).

## Datos (API)

- Contrato en `src/lib/api/types.ts` (compartido) y `src/lib/api/contracts/`
  (por módulo, reexportado desde `types.ts`); `src/lib/api/endpoints.ts` los
  compone en un solo `api`.
- Server Components: `import { api } from "@/lib/api/server"`.
  Client Components: `import { api } from "@/lib/api/browser"`.
- **Simulado o real, dominio por dominio: `API_REAL_DOMAINS`** (variable del
  servidor, separada por comas; los dominios están en `src/lib/api/domains.ts`).
  Todo pasa por el endpoint único `/api/v1/*` de la app, que pide sesión:
  `src/lib/api/dispatch.ts` manda cada dominio a su implementación real
  (`src/lib/api/real-routes.ts`) si figura en la variable, o a la API simulada
  (`src/mocks/`) si no. El servidor lo llama en proceso; el navegador, por fetch.
  Las rutas reales usan los mismos helpers y el mismo contrato que las simuladas
  (`src/lib/api/route.ts`). Lo que un dominio real todavía no tiene sigue saliendo
  de la API simulada, ruta por ruta. Ver `.env.example`.
- La API simulada: `mocks/seed/` es la semilla compartida (productos reales del
  Excel con el motor de precios, clientas, anuncios, pedidos con sus montos,
  equipo y proveedores), así una clienta o un pedido es el mismo en todas las
  pantallas; `mocks/domains/` arma las respuestas de cada módulo; `mocks/db.ts`
  guarda el estado en memoria por dominio (`defineStore`); `mocks/router.ts`
  junta las rutas.
- **Agregar un endpoint**: tipo y función en `contracts/<dominio>.ts` → ruta en
  `mocks/domains/<dominio>.ts` (con datos de `mocks/seed`) → test en
  `mocks/domains/<dominio>.test.ts`.
- **Widget con datos**: Server Component `async` + `AsyncWidget` (Suspense +
  error con "Reintentar"), con un skeleton de la misma forma:
  ```tsx
  <AsyncWidget title="los indicadores" fallback={<InicioKpisSkeleton />}>
    <InicioKpis />
  </AsyncWidget>
  ```
- Filtros y paginación viven en la URL (`searchParams`): ver
  `components/kit/url-search.tsx`.
- Mutaciones desde el cliente: API del navegador + `useOptimistic`
  (ver `notifications-menu.tsx`).
- Textos que dependen de `Intl` (fechas, porcentajes) se formatean en el
  servidor con `src/lib/format.ts` y se pasan armados al cliente.
- Dominio real: sus rutas van en `src/lib/api/real-routes.ts` y se activa sumándolo
  a `API_REAL_DOMAINS`. Los errores HTTP llegan como `ApiError` (`status`, `message`).
- `MOCK_API_DELAY_MS` simula latencia; `MOCK_API_FAILURE_RATE=1` fuerza errores
  para revisar los estados de falla.

## Tests

- Vitest + Testing Library (jsdom). Los archivos `*.test.ts(x)` van junto al código.
- Lógica de servidor y API: agregar `// @vitest-environment node` al inicio.
  `connection()` de `next/server` se mockea (ver `src/lib/api/server.test.ts`).
- Client Components que usan `next/navigation` o la API del navegador: `vi.mock`
  del módulo (ver `kit/url-search.test.tsx`, `notifications-menu.test.tsx`).
- Vitest no renderiza Server Components `async`: testear su lógica (router,
  format) o cubrirlos con tests E2E.
- `format.test.ts` asume `locale: "es-AR"`; ajustarlo si se cambia el idioma.

## Estructura de una pantalla

```tsx
<PageHeader eyebrow="Sección" title="Título" description="…" actions={<Button>…</Button>} />
<PageBody>
  <Card>…</Card>
</PageBody>
```

`PageHeader` es la banda blanca superior; `PageBody` es el contenedor sobre el
canvas gris, de ancho completo y con el mismo padding en los cuatro lados.
Las cards son blancas con borde fino (`Card`, `CardHeader`, `CardTitle`,
`CardDescription`, `CardContent`, `CardFooter`). Las tablas usan
`components/ui/table.tsx` (`Table`, `TableHeader`, `TableBody`, `TableRow`,
`TableHead`, `TableCell`), que ya se alinean con el padding de la card.

## Estados de carga (skeletons)

- Primitiva: `Skeleton` (con shimmer) + `LoadingLabel` (anuncio para lectores
  de pantalla) en `components/ui/skeleton.tsx`.
- Presets en `components/views/skeletons.tsx`: `SkeletonText`, `CardSkeleton`,
  `StatGridSkeleton`, `ChartSkeleton`, `BarListSkeleton`, `TableSkeleton`,
  `PageSkeleton`.
- Regla: el texto fijo (títulos, encabezados de tabla) se muestra real; solo los
  datos van como skeleton, con la misma forma que el contenido final.
- Cada widget con datos lleva el suyo vía `AsyncWidget fallback={…}`.
  `(dashboard)/loading.tsx` muestra `PageSkeleton` cuando una página espera
  datos directo en su `page.tsx`.
  Cada sección con subpantallas reexporta ese archivo en su propio `loading.tsx`:
  sin él, pasar entre dos pantallas de la sección espera la sesión sin mostrar
  nada, y `next dev` lo marca como "uncached data". Un test lo verifica.
- Para verlos con calma: `MOCK_API_DELAY_MS=3000` en `.env.local`.

## Avisos (toasts)

- `import { toast } from "@/lib/toast"` (nunca desde `sonner` directo). El
  `<Toaster />` ya está en el root layout.
- Confirmar cada acción del usuario: `toast.success("…")`; errores con
  `action: { label: "Reintentar", onClick }`; operaciones async con
  `toast.promise(promesa, { loading, success, error })`; acciones reversibles
  con `action: { label: "Deshacer", … }`.
- En tests, mockear `@/lib/toast` y verificar las llamadas
  (ver `notifications-menu.test.tsx`).

## Convenciones

- Colores siempre por token: `bg-primary`, `bg-surface`, `bg-canvas`,
  `text-muted-foreground`, `border-border`, `text-success`… Nunca hex en
  componentes. Tonos suaves con opacidad: `bg-primary/10`.
- Texto sobre fondos tintados con la marca usa `text-foreground` (no el color de
  marca) para que cualquier paleta cumpla contraste.
- `secondary` y `accent` son colores de **marca**, no los grises de shadcn. Si se
  copia un componente de shadcn, cambiar `hover:bg-accent`/`bg-secondary` por
  `hover:bg-muted`/`bg-muted`.
- UI base en `src/components/ui` (Radix vía `radix-ui` + `cva` + `cn`).
  Íconos de `lucide-react` con `aria-hidden` cuando acompañan texto.
- Animación: CSS para micro-interacciones (`active:scale-[0.97]`, curvas
  `ease-snappy`); `motion/react` para alturas `auto` y entradas/salidas. Todo
  respeta `prefers-reduced-motion` (`MotionConfig` + regla global en globals.css).
- Tema y aside colapsado: atributos `data-theme` y `data-sidebar` en `<html>`,
  aplicados por un script inline antes del primer paint (`src/lib/preferences.ts`).
  Variantes de Tailwind: `dark:` y `sidebar-collapsed:`.
- `cacheComponents` está activo: no leer `cookies()`/`headers()` ni usar
  `new Date()` en Server Components prerenderizados sin `<Suspense>`. Para la
  fecha local ver `src/components/layout/today-label.tsx`.
- Componentes del layout que leen la URL (`usePathname`, `useSearchParams`)
  van dentro de `<Suspense>` con un fallback equivalente: en rutas con
  parámetros dinámicos (`/clientes/[id]`) la URL se conoce recién en el request
  y, sin Suspense, el build falla (ver `sidebar.tsx` y `breadcrumbs.tsx`).
- Auth: un solo usuario con credenciales fijas en `src/lib/session.ts`
  (`eliasllaury@gmail.com`), cookie de sesión firmada con `AUTH_SECRET`,
  Server Actions `signIn`/`signOut` en `src/lib/auth-actions.ts` y
  `src/proxy.ts` (el middleware de Next 16) que manda a `/login` sin sesión.
  `currentUser` (`src/lib/auth.ts`) es el usuario que muestran las pantallas.
- Workflows (`src/workflows/`): el cuerpo de una función con `"use workflow"` corre sin
  Node. Lo que use ahí no puede arrastrar Prisma, pino ni crypto (por eso
  `integrations/dux/paginas.ts` está aparte); los pasos, con `"use step"`, sí pueden. Los
  tests no lo ven, porque ahí las directivas no hacen nada: lo ve la compilación, y solo si
  una ruta arranca el workflow.
- Rutas inexistentes muestran el 404 dentro del dashboard
  (`(dashboard)/[...slug]` + `(dashboard)/not-found.tsx`).

## Comandos

```bash
npm run dev         # desarrollo
npm run build       # build de producción (valida tipos)
npm run lint
npm test            # tests una vez
npm run test:watch  # tests en modo watch
```
