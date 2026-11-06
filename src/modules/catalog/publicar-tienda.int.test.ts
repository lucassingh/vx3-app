import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { ProductoDeLaTienda } from "@/integrations/tiendanube/client";
import type { CatalogoAltaInput, CatalogoEstadoEnLaTienda } from "@/lib/api/contracts/catalogo";
import { ConflictError, ExternalServiceError } from "@/lib/errors";
import { guardarLecturaDeLaTienda } from "./lectura-tienda";
import { avanzarEnLaTienda, mostrarEnLaTienda, pedidoDeLaTienda } from "./publicar-tienda";

const tienda = vi.hoisted(() => ({
  buscar: vi.fn(),
  categorias: vi.fn(),
  producto: vi.fn(),
  crear: vi.fn(),
  foto: vi.fn(),
  mostrar: vi.fn(),
  escrituraFalla: null as Error | null,
}));

vi.mock("@/integrations/tiendanube", () => ({
  tiendaNube: async () => ({
    buscarPorSku: tienda.buscar,
    listarCategorias: tienda.categorias,
    producto: tienda.producto,
  }),
  tiendaNubeEscritura: async () => {
    if (tienda.escrituraFalla) throw tienda.escrituraFalla;
    return { crearProducto: tienda.crear, agregarFoto: tienda.foto, mostrarProducto: tienda.mostrar };
  },
}));

const db = getDb();

const INPUT = {
  sku: "CTSPN20",
  rubro: "CORPIÑOS",
  subrubro: "TOP SEGUNDA PIEL NORMAL",
  nombre: "TOP - CURVA DE TALLES M A XL - NEGRO",
  prenda: "TOP",
  color: "NEGRO",
  copa: "",
  marca: "AITANA",
  proveedorId: "7",
  tela: "",
  colores: ["NEGRO"],
  talles: "M A XL",
  atributos: {},
  opcionales: {},
  costoDocena: 48_000,
  pesoBultoKg: 0.7,
  medidasCm: [32, 18, 9],
  fotos: [
    { clave: "catalogo/uno.jpg", nombre: "uno.jpg", ancho: 800, alto: 800 },
    { clave: "catalogo/dos.jpg", nombre: "dos.jpg", ancho: 800, alto: 800 },
  ],
} satisfies CatalogoAltaInput;

const CATEGORIAS = [
  { id: 1, parent: 0, name: { es: "MUJER" }, visibility: "visible" },
  { id: 2, parent: 1, name: { es: "CORPIÑOS" }, visibility: "visible" },
  { id: 3, parent: 0, name: { es: "CORPIÑOS" }, visibility: "hidden" },
];

const producto = (cambios: Partial<ProductoDeLaTienda> = {}): ProductoDeLaTienda => ({
  id: 77,
  published: false,
  categories: [{ id: 2 }],
  images: [],
  variants: [{ sku: "CTSPN20-6", price: "0.00" }],
  ...cambios,
});

const crearBorrador = async (cambios: Partial<CatalogoAltaInput> = {}, enDux = true) => {
  const { id } = await db.catalogDraft.create({
    data: {
      id: newId(),
      data: { ...INPUT, ...cambios } as object,
      createdByLabel: "Prueba",
      createdAt: new Date(),
      updatedAt: new Date(),
      duxDoneAt: enDux ? new Date() : null,
    },
  });
  return id;
};

const estado = async (id: string) => {
  const { storeState } = await db.catalogDraft.findUniqueOrThrow({ where: { id } });
  return storeState as CatalogoEstadoEnLaTienda | null;
};

const limpiar = async () => {
  await db.catalogDraft.deleteMany();
  await db.syncLock.deleteMany();
  await db.storeProduct.deleteMany();
};

beforeEach(async () => {
  await limpiar();
  for (const mock of [tienda.buscar, tienda.categorias, tienda.producto, tienda.crear, tienda.foto, tienda.mostrar]) {
    mock.mockReset();
  }
  tienda.buscar.mockResolvedValue(null);
  tienda.categorias.mockResolvedValue(CATEGORIAS);
  tienda.producto.mockResolvedValue(producto());
  tienda.crear.mockResolvedValue(producto());
  tienda.foto.mockResolvedValue(undefined);
  tienda.mostrar.mockResolvedValue(undefined);
  tienda.escrituraFalla = null;
  vi.stubEnv("MEDIA_URL", "https://abc.public.blob.vercel-storage.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("de a un paso", () => {
  it("primero el producto, oculto y en la categoría visible, con el bulto como única variante", async () => {
    const id = await crearBorrador();

    const { hecho, borrador } = await avanzarEnLaTienda(id);

    expect(hecho).toEqual({ accion: "producto", sku: "CTSPN20-6", productoId: 77 });
    expect(borrador.tienda).toMatchObject({ productoId: 77, fotos: 0, visible: false, error: false });
    expect(tienda.crear).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        name: { es: "TOP - CURVA DE TALLES M A XL - NEGRO - MEDIA DOCENA" },
        published: false,
        categories: [2],
        variants: [{ sku: "CTSPN20-6", price: "0", weight: 0.7, width: 18, height: 9, depth: 32 }],
      }),
    );
  });

  it("después cada foto, en orden, con su dirección pública", async () => {
    const id = await crearBorrador();
    await avanzarEnLaTienda(id);

    await avanzarEnLaTienda(id);
    tienda.producto.mockResolvedValue(producto({ images: [{ id: 1 }] }));
    const { borrador } = await avanzarEnLaTienda(id);

    expect(tienda.foto.mock.calls).toEqual([
      [77, { src: "https://abc.public.blob.vercel-storage.com/catalogo/uno.jpg", position: 1 }],
      [77, { src: "https://abc.public.blob.vercel-storage.com/catalogo/dos.jpg", position: 2 }],
    ]);
    expect(borrador.tienda?.fotos).toBe(2);
  });

  it("con todo arriba, otra llamada no toca nada", async () => {
    const id = await crearBorrador({ fotos: [] });
    await avanzarEnLaTienda(id);
    tienda.crear.mockClear();

    const { hecho } = await avanzarEnLaTienda(id);

    expect(hecho).toBeNull();
    expect(tienda.crear).not.toHaveBeenCalled();
    expect(tienda.foto).not.toHaveBeenCalled();
  });
});

describe("si se corta, se retoma sin duplicar", () => {
  it("el cruce es por SKU: si ya está en la tienda, no lo crea de nuevo", async () => {
    tienda.buscar.mockResolvedValue(producto({ id: 99, images: [{ id: 1 }] }));
    const id = await crearBorrador();

    const { hecho, borrador } = await avanzarEnLaTienda(id);

    expect(hecho).toBeNull();
    expect(tienda.crear).not.toHaveBeenCalled();
    expect(borrador.tienda).toMatchObject({
      productoId: 99,
      fotos: 1,
      detalle: "Ya estaba en la tienda: no se creó de nuevo.",
    });
  });

  it("si la tienda no confirmó, lo dice; al retomar, lo encuentra por SKU", async () => {
    tienda.crear.mockRejectedValueOnce(
      new ExternalServiceError("Tienda Nube", "Tienda Nube no confirmó el cambio, y no se sabe si quedó hecho."),
    );
    const id = await crearBorrador();

    const { borrador } = await avanzarEnLaTienda(id);
    expect(borrador.tienda).toMatchObject({ error: true, detalle: expect.stringContaining("no confirmó") });

    tienda.buscar.mockResolvedValueOnce(producto());
    const retomado = await avanzarEnLaTienda(id);

    expect(retomado.borrador.tienda).toMatchObject({ productoId: 77, error: false });
    expect(tienda.crear).toHaveBeenCalledOnce();
  });

  it("una foto que ya subió no se vuelve a subir", async () => {
    const id = await crearBorrador();
    await avanzarEnLaTienda(id);
    tienda.producto.mockResolvedValue(producto({ images: [{ id: 1 }] }));

    const { hecho, borrador } = await avanzarEnLaTienda(id);

    expect(hecho).toBeNull();
    expect(tienda.foto).not.toHaveBeenCalled();
    expect(borrador.tienda?.fotos).toBe(1);
  });

  it("una foto rechazada queda para retomar, sin perder la cuenta", async () => {
    const id = await crearBorrador();
    await avanzarEnLaTienda(id);
    tienda.foto.mockRejectedValueOnce(new ExternalServiceError("Tienda Nube", "Tienda Nube rechazó el pedido: foto."));

    const { borrador } = await avanzarEnLaTienda(id);

    expect(borrador.tienda).toMatchObject({ fotos: 0, error: true });

    const retomado = await avanzarEnLaTienda(id);
    expect(retomado.borrador.tienda).toMatchObject({ fotos: 1, error: false, detalle: null });
  });

  it("no queda bloqueado después de un error inesperado", async () => {
    const id = await crearBorrador();
    tienda.crear.mockRejectedValueOnce(new Error("se rompió otra cosa"));

    await expect(avanzarEnLaTienda(id)).rejects.toThrow("se rompió otra cosa");

    await expect(avanzarEnLaTienda(id)).resolves.toBeDefined();
  });
});

describe("lo que frena", () => {
  it("sin estar en DUX, no: el precio y el stock salen de ahí", async () => {
    const id = await crearBorrador({}, false);

    await expect(avanzarEnLaTienda(id)).rejects.toThrow("Primero tiene que estar en DUX");

    expect(tienda.crear).not.toHaveBeenCalled();
  });

  it("fuera de producción no se escribe, y no marca nada", async () => {
    tienda.escrituraFalla = new ConflictError("Fuera de producción no se escribe en Tienda Nube.");
    const id = await crearBorrador();

    await expect(avanzarEnLaTienda(id)).rejects.toThrow("Fuera de producción");

    expect(await estado(id)).toBeNull();
  });

  it("un rubro sin regla no crea una categoría suelta (RN-102)", async () => {
    const id = await crearBorrador({ rubro: "RUBRO NUEVO" });

    const { borrador } = await avanzarEnLaTienda(id);

    expect(borrador.tienda).toMatchObject({ error: true, detalle: expect.stringContaining("no tiene regla") });
    expect(tienda.crear).not.toHaveBeenCalled();
  });

  it("una categoría que falta no se crea: la crea VX3", async () => {
    const id = await crearBorrador({ rubro: "LESS", subrubro: "TALLES ESPECIALES" });

    const { borrador } = await avanzarEnLaTienda(id);

    expect(borrador.tienda?.detalle).toContain("Falta la categoría MUJER › LESS");
    expect(tienda.crear).not.toHaveBeenCalled();
  });

  it("no cae en la raíz oculta con el mismo nombre", async () => {
    tienda.categorias.mockResolvedValue(CATEGORIAS.filter(({ id }) => id !== 2));
    const id = await crearBorrador();

    const { borrador } = await avanzarEnLaTienda(id);

    expect(borrador.tienda?.error).toBe(true);
    expect(tienda.crear).not.toHaveBeenCalled();
  });
});

describe("mostrar", () => {
  const conProducto = async () => {
    const id = await crearBorrador();
    await avanzarEnLaTienda(id);
    return id;
  };

  it("a $ 0 no se muestra (RN-101): DUX todavía no le puso el precio", async () => {
    const id = await conProducto();

    await expect(mostrarEnLaTienda(id)).rejects.toThrow("DUX todavía no le puso el precio");

    expect(tienda.mostrar).not.toHaveBeenCalled();
    expect((await estado(id))?.visible).toBe(false);
  });

  it("sin foto no se muestra (RN-09)", async () => {
    const id = await conProducto();
    tienda.producto.mockResolvedValue(producto({ variants: [{ sku: "CTSPN20-6", price: "31200.00" }] }));

    await expect(mostrarEnLaTienda(id)).rejects.toThrow("Sin foto");

    expect(tienda.mostrar).not.toHaveBeenCalled();
  });

  it("con precio y foto, se muestra y queda registrado", async () => {
    const id = await conProducto();
    tienda.producto.mockResolvedValue(
      producto({ images: [{ id: 1 }], variants: [{ sku: "CTSPN20-6", price: "31200.00" }] }),
    );

    const borrador = await mostrarEnLaTienda(id);

    expect(tienda.mostrar).toHaveBeenCalledExactlyOnceWith(77);
    expect(borrador.tienda?.visible).toBe(true);
    const { storeDoneAt } = await db.catalogDraft.findUniqueOrThrow({ where: { id } });
    expect(storeDoneAt).not.toBeNull();
  });

  it("sin estar en la tienda, no hay nada para mostrar", async () => {
    const id = await crearBorrador();

    await expect(mostrarEnLaTienda(id)).rejects.toThrow("Todavía no está en la tienda");
  });
});

describe("el pedido, para verlo sin mandarlo", () => {
  it("lleva todo lo que se mandaría, y no escribe nada", async () => {
    const id = await crearBorrador();

    const pedido = await pedidoDeLaTienda(id);

    expect(pedido).toMatchObject({
      ruta: ["MUJER", "CORPIÑOS"],
      categoriaId: 2,
      problema: null,
      pedido: { categories: [2], published: false, variants: [{ sku: "CTSPN20-6" }] },
      fotos: [
        "https://abc.public.blob.vercel-storage.com/catalogo/uno.jpg",
        "https://abc.public.blob.vercel-storage.com/catalogo/dos.jpg",
      ],
    });
    expect(tienda.crear).not.toHaveBeenCalled();
  });

  it("sin la tienda a mano igual se ve, y dice qué falta", async () => {
    tienda.categorias.mockRejectedValue(new ExternalServiceError("Tienda Nube", "Todavía no se cargó el token."));
    const id = await crearBorrador();

    expect(await pedidoDeLaTienda(id)).toMatchObject({
      ruta: ["MUJER", "CORPIÑOS"],
      categoriaId: null,
      problema: "Todavía no se cargó el token.",
    });
  });

  it("un rubro sin regla lo dice", async () => {
    const id = await crearBorrador({ rubro: "RUBRO NUEVO" });

    expect(await pedidoDeLaTienda(id)).toMatchObject({
      ruta: null,
      problema: expect.stringContaining("no tiene regla"),
    });
  });
});

describe("la lectura de la tienda", () => {
  const categorias = [
    { id: 1, parent: 0, name: { es: "MUJER" }, visibility: "visible" },
    { id: 2, parent: 1, name: { es: "LESS" }, visibility: "visible" },
    { id: 3, parent: 0, name: { es: "HOMBRE" }, visibility: "visible" },
    { id: 4, parent: 0, name: { es: "LENCERIA" }, visibility: "hidden" },
  ];
  const fila = (id: number, categoria: number, sku = `S${id}-6`) =>
    producto({ id, categories: [{ id: categoria }], variants: [{ sku, price: "100.50" }], published: id !== 4 });

  it("la suma por sección da el total, y marca lo que no cuelga de ninguna", async () => {
    const productos = [fila(1, 2), fila(2, 1), fila(3, 3), fila(4, 4)];

    const resumen = await guardarLecturaDeLaTienda(productos, categorias, new Date());

    expect(resumen).toMatchObject({ productos: 4, visibles: 3, fueraDeLasSecciones: 1 });
    expect(resumen.porSeccion).toMatchObject({ MUJER: 2, HOMBRE: 1, MEDIAS: 0 });
    const suma = Object.values(resumen.porSeccion).reduce((total, cuantos) => total + cuantos, 0);
    expect(suma + resumen.fueraDeLasSecciones).toBe(resumen.productos);
    expect(await db.storeProduct.findUniqueOrThrow({ where: { id: 4n } })).toMatchObject({
      section: null,
      published: false,
    });
    expect(await db.storeProduct.findUniqueOrThrow({ where: { id: 1n } })).toMatchObject({
      section: "MUJER",
      sku: "S1-6",
      priceCents: 10_050n,
    });
  });

  it("se reemplaza entera: lo que ya no está en la tienda deja de contar", async () => {
    await guardarLecturaDeLaTienda([fila(1, 2), fila(2, 2)], categorias, new Date());
    await guardarLecturaDeLaTienda([fila(2, 2)], categorias, new Date());

    expect(await db.storeProduct.count()).toBe(1);
  });
});
