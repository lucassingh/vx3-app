import type { Notification } from "@/lib/api/types";
import { defineStore } from "../db";
import type { Route } from "../http";
import { isoAgo } from "../seed";

/** Centro de alertas (RF-M0-05): lo que la app avisa sola, con link a donde se resuelve. */

const seed: (Omit<Notification, "createdAt"> & { minutesAgo: number })[] = [
  {
    id: "al-6",
    title: "Pedido trabado",
    description: "V-1047 de Yanina Medina lleva 3 h sin respuesta. El bot ya mandó el segundo mensaje.",
    minutesAgo: 8,
    read: false,
    href: "/pedidos/bandeja",
  },
  {
    id: "al-5",
    title: "Margen bajo el piso",
    description: "CAN12 quedó en 18 % después del aumento de Victoria Martínez. Hay un precio sugerido.",
    minutesAgo: 42,
    read: false,
    href: "/stock/margen",
  },
  {
    id: "al-4",
    title: "Anuncio sin ventas",
    description: "“Body de encaje BCN2” gastó US$ 13 en 3 días con 0 pedidos.",
    minutesAgo: 95,
    read: false,
    href: "/pauta/anuncios",
  },
  {
    id: "al-3",
    title: "Transferencia sin cargar",
    description: "Entró $ 86.400 a Supervielle hace 26 h y todavía no está imputada en DUX.",
    minutesAgo: 180,
    read: false,
    href: "/cobros/conciliacion",
  },
  {
    id: "al-2",
    title: "Contraentrega sin rendir",
    description: "8 pedidos entregados por Transtech hace más de 2 días siguen sin rendición.",
    minutesAgo: 420,
    read: true,
    href: "/cobros/contraentrega",
  },
  {
    id: "al-1",
    title: "Reclamo por vencer",
    description: "El reclamo de Brenda Ojeda (falta mercadería) vence el plazo de 24 h en 2 h.",
    minutesAgo: 1_320,
    read: true,
    href: "/postventa",
  },
];

const getAlertas = defineStore("notifications", (now) =>
  seed.map(({ minutesAgo, ...alerta }) => ({ ...alerta, createdAt: isoAgo(minutesAgo, now) })),
);

export const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/notifications$/,
    handler: () =>
      Response.json(getAlertas().toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))),
  },
  {
    method: "POST",
    pattern: /^\/notifications\/read-all$/,
    handler: () => {
      const alertas = getAlertas();
      const updated = alertas.filter((item) => !item.read).length;
      for (const item of alertas) item.read = true;
      return Response.json({ updated });
    },
  },
];
