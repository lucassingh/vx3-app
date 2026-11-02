/** Equipo de VX3 y proveedores. Nombres de pila tal como figuran en los instructivos. */

export type Rol = "admin" | "operaciones" | "postventa" | "compras" | "marketing" | "solo_lectura";

export type UsuarioSeed = {
  id: string;
  nombre: string;
  email?: string;
  rol: Rol;
  puesto: string;
};

export const equipo: UsuarioSeed[] = [
  { id: "u-elias", nombre: "Elías Llaury", email: "eliasllaury@gmail.com", rol: "admin", puesto: "Socio" },
  { id: "u-leo", nombre: "Leo", email: "leo@vx3.com.ar", rol: "operaciones", puesto: "Pedidos, facturación y cobros" },
  { id: "u-lucia", nombre: "Lucía", email: "lucia@vx3.com.ar", rol: "postventa", puesto: "Post-venta y reclamos" },
  { id: "u-juan", nombre: "Juan", email: "juan@vx3.com.ar", rol: "compras", puesto: "Compras y altas de producto" },
  { id: "u-masuno", nombre: "Más Uno", rol: "admin", puesto: "Soporte técnico de la app" },
];

export type ProveedorSeed = {
  id: string;
  nombre: string;
  /** RN-36: al importado no se le reclama la mercadería fallada; al fabricante sí. */
  tipo: "fabricante" | "importador" | "mayorista";
  rubros: string[];
  frecuencia: string;
  condiciones: string;
  plazoEntregaDias: number;
  ultimaCompraDias: number;
  /** Compras de los últimos 30 días, en pesos. */
  compras30d: number;
  notas: string;
};

export const proveedores: ProveedorSeed[] = [
  { id: "p-bethy", nombre: "Bethy", tipo: "mayorista", rubros: ["Conjuntos", "Corpiños", "Less", "Invierno", "Body"], frecuencia: "Semanal", condiciones: "Transferencia contra entrega de la boleta", plazoEntregaDias: 2, ultimaCompraDias: 3, compras30d: 4_860_000, notas: "Trabaja Smart Sexy, Linda Luna, Condeza, AmorArma y Vicblack. Avisa por WhatsApp cuando entra temporada." },
  { id: "p-ricardo", nombre: "Ricardo Flores", tipo: "mayorista", rubros: ["Medias", "Less", "Hombre", "Vedetinas", "Pijamas"], frecuencia: "Cada 10 días", condiciones: "Efectivo en el local", plazoEntregaDias: 1, ultimaCompraDias: 6, compras30d: 2_940_000, notas: "Las medias de niño vienen surtidas: contar por talle al recibir." },
  { id: "p-cintia", nombre: "Cintia", tipo: "fabricante", rubros: ["Deportivo", "Conjuntos", "Body"], frecuencia: "Cada 15 días", condiciones: "50 % de seña y saldo al retirar", plazoEntregaDias: 7, ultimaCompraDias: 11, compras30d: 1_720_000, notas: "Fabrica a pedido: los colores se eligen al encargar." },
  { id: "p-victoria", nombre: "Victoria Martínez", tipo: "fabricante", rubros: ["Corpiños", "Conjuntos", "Vedetinas"], frecuencia: "Cada 15 días", condiciones: "Transferencia a 7 días", plazoEntregaDias: 5, ultimaCompraDias: 9, compras30d: 1_310_000, notas: "Falla de costura: se le reclama y repone en la próxima entrega." },
  { id: "p-beatriz", nombre: "Beatriz Lencería", tipo: "mayorista", rubros: ["Vedetinas", "Boxer", "Culotes"], frecuencia: "Mensual", condiciones: "Transferencia anticipada", plazoEntregaDias: 3, ultimaCompraDias: 22, compras30d: 640_000, notas: "Calvin Klein y talles especiales." },
  { id: "p-edgar", nombre: "Edgar", tipo: "importador", rubros: ["Vedetinas", "Reductores"], frecuencia: "Cuando llega contenedor", condiciones: "Efectivo, sin factura", plazoEntregaDias: 1, ultimaCompraDias: 34, compras30d: 0, notas: "Importado: la mercadería fallada no se reclama (RN-36)." },
  { id: "p-carmen", nombre: "Carmen", tipo: "fabricante", rubros: ["Less"], frecuencia: "Cada 15 días", condiciones: "Efectivo al retirar", plazoEntregaDias: 4, ultimaCompraDias: 14, compras30d: 420_000, notas: "Less regulables. Entrega en bolsas de a 12." },
  { id: "p-vilma", nombre: "Vilma", tipo: "fabricante", rubros: ["Vedetinas", "Culotes"], frecuencia: "Mensual", condiciones: "Transferencia contra entrega", plazoEntregaDias: 6, ultimaCompraDias: 27, compras30d: 310_000, notas: "Talles grandes (XL a 3XL)." },
  { id: "p-silvia", nombre: "Silvia (Cativa)", tipo: "fabricante", rubros: ["Conjuntos"], frecuencia: "Cada 20 días", condiciones: "Transferencia a 15 días", plazoEntregaDias: 8, ultimaCompraDias: 18, compras30d: 880_000, notas: "Conjuntos con culote." },
];
