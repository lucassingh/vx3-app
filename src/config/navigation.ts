import {
  Activity,
  ArrowLeftRight,
  Banknote,
  Bot,
  Boxes,
  Calculator,
  ClipboardList,
  Contact,
  Factory,
  HandCoins,
  Inbox,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessagesSquare,
  PackageCheck,
  PackagePlus,
  Percent,
  Plug,
  ReceiptText,
  Repeat,
  Settings,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Target,
  Truck,
  UserRound,
  UsersRound,
  Wallet,
  Warehouse,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

/** Destino navegable. Cada `href` necesita su page.tsx en src/app/(dashboard). */
export type NavLink = {
  title: string;
  href: string;
  icon?: LucideIcon;
  /** Se muestra como bajada en el header de la pantalla. */
  description?: string;
  /** Etiqueta corta junto al item (ej. "Nuevo"). */
  badge?: string;
};

/** Item del aside: un link directo o un grupo desplegable con subitems. */
export type NavItem =
  | (NavLink & { icon: LucideIcon; items?: never })
  | {
      title: string;
      icon: LucideIcon;
      items: NavLink[];
      href?: never;
      description?: never;
      badge?: never;
    };

export type NavGroup = Extract<NavItem, { items: NavLink[] }>;

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Módulos de la solución (solucion_doc/05): M10 Inicio · M11 Conversaciones ·
 * M12 Clientas · M9 Pauta · M3 Bot · M4 Vidriera · M5 Pedidos · M6 Envíos ·
 * M7 Cobros · M8 Post-venta · M1 Productos · M2 Stock y compras · M0 Configuración.
 */
export const navigation: NavSection[] = [
  {
    label: "General",
    items: [
      {
        title: "Inicio",
        href: "/",
        icon: LayoutDashboard,
        description: "Qué pasó hoy, qué está trabado y dónde se está perdiendo plata.",
      },
    ],
  },
  {
    label: "Ventas",
    items: [
      {
        title: "Conversaciones",
        href: "/conversaciones",
        icon: MessagesSquare,
        description: "El WhatsApp de ventas y el del local en una sola bandeja, con la ficha de la clienta al costado.",
      },
      {
        title: "Clientas",
        icon: UsersRound,
        items: [
          {
            title: "Fichas",
            href: "/clientas/fichas",
            icon: Contact,
            description:
              "Una ficha por clienta, unida por su teléfono: pedidos, conversaciones, envíos, cobros y reclamos.",
          },
          {
            title: "Recompra del día",
            href: "/clientas/recompra",
            icon: Repeat,
            description: "Las clientas para reactivar hoy, con el mensaje sugerido en el tono de VX3.",
          },
        ],
      },
      {
        title: "Pauta",
        icon: Megaphone,
        items: [
          {
            title: "Anuncios y RM",
            href: "/pauta/anuncios",
            icon: Target,
            description:
              "Gasto, pedidos verificados y margen real por anuncio, con el criterio de atribución de Elías.",
          },
          {
            title: "Presupuesto",
            href: "/pauta/presupuesto",
            icon: Wallet,
            description: "Gasto real contra lo planificado por campaña, en dólares y en pesos.",
          },
        ],
      },
      {
        title: "Bot de ventas",
        icon: Bot,
        items: [
          {
            title: "Rendimiento",
            href: "/bot/rendimiento",
            icon: Activity,
            description: "Qué respondió el bot, cuándo derivó y por qué, y cuánto cuesta cada conversación.",
          },
          {
            title: "Configuración",
            href: "/bot/configuracion",
            icon: SlidersHorizontal,
            description: "Tono, reglas, preguntas frecuentes, palancas y derivación, con versiones y chat de prueba.",
          },
        ],
      },
      {
        title: "Vidriera",
        href: "/vidriera",
        icon: Store,
        description: "El catálogo propio para la clienta: colecciones, destacados y lo que pasa en el embudo.",
      },
    ],
  },
  {
    label: "Operación",
    items: [
      {
        title: "Pedidos",
        icon: ShoppingBag,
        items: [
          {
            title: "Bandeja",
            href: "/pedidos/bandeja",
            icon: Inbox,
            description: "Todos los pedidos (bot, vidriera, local y Tienda Nube) en un solo lugar, con su estado.",
          },
          {
            title: "Facturación",
            href: "/pedidos/facturacion",
            icon: ReceiptText,
            description:
              "Los pedidos listos para facturar, con los chequeos en verde. Se factura en un clic o en lote.",
          },
        ],
      },
      {
        title: "Envíos",
        icon: Truck,
        items: [
          {
            title: "Despacho del día",
            href: "/envios/despacho",
            icon: PackageCheck,
            description: "Lo que sale hoy por cada transportista, con los cortes horarios.",
          },
          {
            title: "Cotizador",
            href: "/envios/cotizador",
            icon: Calculator,
            description: "Arma los bultos y cotiza bulto por bulto, con respaldo si el Correo no responde.",
          },
        ],
      },
      {
        title: "Cobros",
        icon: Landmark,
        items: [
          {
            title: "Conciliación",
            href: "/cobros/conciliacion",
            icon: ArrowLeftRight,
            description:
              "La app propone el cruce entre cada transferencia y su pedido en los cuatro bancos. Se confirma y queda en DUX.",
          },
          {
            title: "Contraentrega",
            href: "/cobros/contraentrega",
            icon: HandCoins,
            description: "Cada pedido de facturado a rendido, y el reclamo semanal a Transtech armado solo.",
          },
          {
            title: "Caja del día",
            href: "/cobros/caja",
            icon: Banknote,
            description:
              "Cuánto se puede gastar hoy en mercadería: los saldos de los cuatro bancos y el efectivo, lo que vence y lo que se espera cobrar.",
          },
        ],
      },
      {
        title: "Post-venta",
        href: "/postventa",
        icon: LifeBuoy,
        description: "Reclamo, evidencia, resolución, nota de crédito y causa en un solo registro.",
      },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        title: "Productos",
        icon: Shirt,
        items: [
          {
            title: "Catálogo",
            href: "/productos/catalogo",
            icon: LayoutGrid,
            description: "La fuente única del producto: atributos, fotos, salud y dónde está publicado.",
          },
          {
            title: "Alta de producto",
            href: "/productos/alta",
            icon: PackagePlus,
            description: "Un formulario con SKU, nombre y precios sugeridos. Publica en DUX y Tienda Nube en un clic.",
          },
          {
            title: "Combos y flyers",
            href: "/productos/combos",
            icon: WandSparkles,
            description: "Combos sugeridos por margen y rotación, y los flyers para feed e historias.",
          },
        ],
      },
      {
        title: "Stock y compras",
        icon: Boxes,
        items: [
          {
            title: "Stock",
            href: "/stock/espejo",
            icon: Warehouse,
            description: "El stock de DUX con lo reservado y lo disponible, en prendas y en bultos.",
          },
          {
            title: "Margen y precios",
            href: "/stock/margen",
            icon: Percent,
            description: "Control de margen todos los días, productos bajo el piso y capas de costo por agotarse.",
          },
          {
            title: "Compras",
            href: "/stock/compras",
            icon: ClipboardList,
            description: "Recepción digital de la mercadería: lo contado contra la boleta, costos y carga en DUX.",
          },
          {
            title: "Proveedores",
            href: "/stock/proveedores",
            icon: Factory,
            description: "Condiciones, frecuencias y qué se le compra a cada uno: lo que hoy sabe Juan, registrado.",
          },
        ],
      },
    ],
  },
  {
    label: "Configuración",
    items: [
      {
        title: "Reglas de negocio",
        href: "/configuracion/reglas",
        icon: ListChecks,
        description:
          "Coeficientes, mínimos, umbrales y textos que usan el bot y los módulos, con historial de cambios.",
      },
      {
        title: "Integraciones",
        href: "/configuracion/integraciones",
        icon: Plug,
        description: "Estado de DUX, Meta, WhatsApp, Tienda Nube, Correo, Zupply y los bancos, con sus credenciales.",
      },
      {
        title: "IA y consumo",
        href: "/configuracion/ia",
        icon: Sparkles,
        description: "La API key de Claude, el modelo del bot y el consumo por día, por mes y por conversación.",
      },
      {
        title: "Usuarios y roles",
        href: "/configuracion/usuarios",
        icon: ShieldCheck,
        description: "Quién entra a la app, con qué rol, y el registro de auditoría.",
      },
      {
        title: "Ajustes",
        href: "/ajustes",
        icon: Settings,
        description: "Apariencia y avisos de tu cuenta.",
      },
    ],
  },
];

/** Links del menú del avatar en la navbar. */
export const userNavigation: NavLink[] = [
  {
    title: "Mi perfil",
    href: "/perfil",
    icon: UserRound,
    description: "Tus datos, tu acceso y tus sesiones abiertas.",
  },
  { title: "Ajustes", href: "/ajustes", icon: Settings },
];
