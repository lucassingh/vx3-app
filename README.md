# Dashboard starter

Cascarón de dashboard profesional y reutilizable: aside con secciones, items y
subitems, navbar con breadcrumb y avatar, tema claro/oscuro y un área de
pantallas lista para construir. Se adapta a la marca de un cliente editando
solo los archivos de `src/config/`.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript ·
Tailwind CSS 4 · Radix UI · Motion · Lucide · Vitest + Testing Library.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # tests unitarios
```

Abrí http://localhost:3000 e ingresá con `eliasllaury@gmail.com` / `Admin123456!`
(credenciales fijas por ahora, ver `src/lib/session.ts`).

## Qué incluye

- **Layout**: aside blanco con secciones y grupos desplegables, navbar con botón
  de colapsar junto al breadcrumb, avatar con menú de usuario y cierre de
  sesión al pie del aside.
- **Aside colapsable**: se reduce a íconos con tooltips y menús flotantes para
  los subitems. Atajo `⌘B` / `Ctrl+B`. En mobile se convierte en drawer.
- **Tema claro y oscuro**: claro, oscuro o sistema, persistido y sin parpadeo
  al cargar. En claro, el área de pantallas usa `#f3f3f5`, el aside, la navbar y
  las cards son blancos y los bordes son finos.
- **API simulada**: Inicio y notificaciones piden sus datos a una API mock con
  latencia real, búsqueda y paginación en la URL, skeletons de carga y errores
  por widget con "Reintentar". Pasar al backend real es `NEXT_PUBLIC_API_MOCK=false` + `API_URL`.
- **Skeletons**: presets con shimmer (KPIs, gráfico, lista, tabla, card,
  página completa) para que cada carga tenga la forma del contenido final.
- **Avisos (toasts)**: Sonner con los tokens del tema; éxito, error con
  reintento, promesas y deshacer. `import { toast } from "@/lib/toast"`.
- **Pantallas de ejemplo**: Inicio con KPIs, gráfico de actividad, distribución y
  tabla con búsqueda; una pantalla placeholder por cada item del menú; Ajustes
  con selector de tema y vista previa de los colores de marca; login y 404.
- **Tests**: Vitest + Testing Library, con ejemplos de lógica, API, componentes
  con teclado y mutaciones optimistas.
- **Accesibilidad**: HTML semántico, skip link, foco visible, `aria-current`,
  navegación por teclado (incluido el gráfico), contraste AA y respeto por
  `prefers-reduced-motion`.

## Adaptarlo a un cliente

| Qué | Dónde |
| --- | --- |
| Colores primary / secondary / accent (claro y oscuro) | `src/config/theme.css` |
| Nombre, bajada, logo, idioma, versión, tema inicial | `src/config/site.ts` |
| Secciones, items y subitems del aside | `src/config/navigation.ts` |
| Tipografías | `src/config/fonts.ts` |
| Favicon | `src/app/icon.svg` |
| Usuario y auth (simulados) | `src/lib/auth.ts` |

Cada `href` de la navegación tiene su pantalla en
`src/app/(dashboard)/<href>/page.tsx`. Al agregar un item, creá su `page.tsx`
(podés empezar con `<PlaceholderView href="/ruta" />`); una ruta sin página
muestra el 404 dentro del dashboard.

### Pedírselo a Claude

El repo incluye un `CLAUDE.md` con el procedimiento completo, así que alcanza
con algo como:

> Adaptá el dashboard para **Cliente X**: primary `#1d4ed8`, secondary
> `#0f172a`, accent `#f59e0b`. Navegación: General → Inicio, Clientes,
> Facturación (Emitidas, Recibidas); Configuración → Usuarios, Ajustes.

## Datos y API simulada

Los componentes nunca llaman a `fetch` directo: usan `api`, tipado con el
contrato de `src/lib/api/types.ts`.

```tsx
// Server Component
import { api } from "@/lib/api/server";
const page = await api.records.list({ q: "atlas", page: 1 });

// Client Component
import { api } from "@/lib/api/browser";
await api.notifications.markAllRead();
```

| Variable (`.env.local`) | Efecto |
| --- | --- |
| `NEXT_PUBLIC_API_MOCK` | `true` (o vacía) = API simulada · `false` = API real. Reiniciar `npm run dev` al cambiarla. |
| `API_URL` / `NEXT_PUBLIC_API_URL` | URL de la API real (servidor / navegador), con el mock apagado. |
| `AUTH_SECRET` | Firma de la cookie de sesión. |
| `MOCK_API_DELAY_MS` | Latencia simulada (default 350 ms). |
| `MOCK_API_FAILURE_RATE` | Probabilidad de error 503 (0 a 1), para ver los estados de falla. |

La API simulada vive en `src/mocks/` y responde en `/api/mock/*`
(probá `/api/mock/records?q=atlas`). Sus datos están en memoria: los cambios
(por ejemplo, marcar notificaciones como leídas) duran hasta reiniciar el servidor.

## Tests

```bash
npm test            # una vez (CI)
npm run test:watch  # modo watch
```

Incluye tests de navegación (verifica que cada item del menú tenga su página),
formato, preferencias, la API simulada, el cliente de API, el gráfico con
teclado, la búsqueda con debounce, las notificaciones con actualización
optimista, los avisos (toasts), el botón de copiar y los skeletons. Los Server Components `async` no se pueden renderizar en Vitest; su
lógica se prueba por separado.

## Estructura

```
src/
├─ config/            ← todo lo que cambia por cliente
│  ├─ theme.css       colores, superficies, estados, radios
│  ├─ site.ts         identidad del producto
│  ├─ navigation.ts   aside y menú de usuario
│  └─ fonts.ts
├─ app/
│  ├─ (auth)/login/   login de demo
│  ├─ (dashboard)/    layout con aside + navbar y una carpeta por pantalla
│  └─ api/mock/       API simulada para el navegador
├─ components/
│  ├─ layout/         aside, navbar, breadcrumb, menús, PageHeader/PageBody
│  ├─ ui/             Button, Card, Table, Badge, Input, Avatar, DropdownMenu,
│  │                  Tooltip, Skeleton, Toaster, CopyButton
│  ├─ views/          PlaceholderView, AsyncWidget, presets de skeletons
│  ├─ kit/            bloques de pantalla (KPIs, barras, gráfico, embudo…)
│  ├─ inicio/         widgets del Inicio (M10)
│  └─ <dominio>/      componentes de cada módulo (pedidos, cobros, pauta…)
├─ mocks/             datos semilla, base en memoria y rutas de la API simulada
├─ hooks/             useTheme, useSignOut
├─ lib/
│  ├─ api/            contrato, endpoints y clientes (server / browser)
│  └─ …               preferencias, navegación, formato, auth, utils
└─ test/              setup de Vitest
```

## Notas técnicas

- **Sin flash al cargar**: un script inline en `<head>` aplica `data-theme` y
  `data-sidebar` en `<html>` antes del primer paint; React los lee con
  `useSyncExternalStore`. Así el layout queda estático (compatible con Cache
  Components) y no hay errores de hidratación.
- **Tokens**: `theme.css` define variables CSS y `globals.css` las expone a
  Tailwind (`bg-primary`, `bg-surface`, `bg-canvas`, `text-muted-foreground`…).
  Los tonos suaves se derivan con opacidad (`bg-primary/10`), sin variables extra.
- **Variantes propias**: `dark:` y `sidebar-collapsed:` (esta solo aplica en desktop).
