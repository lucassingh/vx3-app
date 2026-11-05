import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { navigation } from "@/config/navigation";
import { mockRoutes } from "@/mocks/router";
import { areaDeApi, areaDePagina, navegacionPara, puedeVerPagina } from "./access";

/** Lo que cualquiera con sesión puede usar. */
const ABIERTAS_API = ["/dashboard", "/notifications", "/plataforma/preferencias", "/plataforma/perfil"];
const ABIERTAS_PAGINAS = ["/", "/perfil", "/ajustes", "/sin-permiso"];

function hrefs() {
  return navigation.flatMap((section) =>
    section.items.flatMap((item) => (item.items ? item.items.map((link) => link.href) : [item.href])),
  );
}

describe("área de cada pantalla", () => {
  it("cada pantalla del menú tiene área, salvo las de todos", () => {
    const sinArea = hrefs().filter((href) => areaDePagina(href) === null);
    expect(sinArea.every((href) => ABIERTAS_PAGINAS.includes(href))).toBe(true);
  });

  it("gana el prefijo más largo", () => {
    expect(areaDePagina("/configuracion/reglas")).toBe("bot");
    expect(areaDePagina("/configuracion/usuarios")).toBe("plataforma");
    expect(areaDePagina("/stock/espejo")).toBe("catalogo");
    expect(areaDePagina("/stock/margen")).toBe("compras");
    expect(areaDePagina("/pautas")).toBeNull();
  });

  it("postventa no ve Pauta ni Configuración, y sí sus pantallas", () => {
    expect(puedeVerPagina("postventa", "/pauta/anuncios")).toBe(false);
    expect(puedeVerPagina("postventa", "/configuracion/usuarios")).toBe(false);
    expect(puedeVerPagina("postventa", "/postventa")).toBe(true);
    expect(puedeVerPagina("postventa", "/perfil")).toBe(true);
  });
});

describe("área de cada ruta de la API", () => {
  it("toda ruta del mock tiene área, salvo las de todos", () => {
    const sinArea = mockRoutes
      // /^\/cobros\/caja$/ → "/cobros/caja" (hasta el primer parámetro).
      .map((route) => (route.pattern.source.replace(/\\\//g, "/").split("(")[0] ?? "").replace(/^\^|\$$/g, ""))
      .filter((path) => areaDeApi(path) === null && !ABIERTAS_API.some((abierta) => path.startsWith(abierta)));
    expect(sinArea).toEqual([]);
  });

  it("separa el stock del catálogo de los costos y las compras", () => {
    expect(areaDeApi("/stock/espejo?q=MSU")).toBe("catalogo");
    expect(areaDeApi("/stock/margen")).toBe("compras");
    expect(areaDeApi("/plataforma/reglas")).toBe("bot");
    expect(areaDeApi("/plataforma/perfil/sesiones")).toBeNull();
  });
});

describe("menú por rol", () => {
  const titulos = (role: Parameters<typeof navegacionPara>[0]) =>
    navegacionPara(role, navigation).flatMap((section) => section.items.map((item) => item.title));

  it("admin ve todo", () => {
    expect(navegacionPara("admin", navigation)).toEqual(navigation);
  });

  it("postventa no ve Pauta ni las pantallas de Configuración", () => {
    expect(titulos("postventa")).not.toContain("Pauta");
    expect(titulos("postventa")).not.toContain("Usuarios y roles");
    expect(titulos("postventa")).toContain("Post-venta");
  });

  it("un grupo queda solo con lo que se puede ver, y sin nada desaparece", () => {
    const stock = navegacionPara("postventa", navigation)
      .flatMap((section) => section.items)
      .find((item) => item.title === "Stock y compras");
    expect(stock?.items?.map((link) => link.href)).toEqual(["/stock/espejo"]);
    expect(titulos("compras")).not.toContain("Cobros");
  });
});

describe("cada pantalla del dashboard se protege", () => {
  const base = join(process.cwd(), "src", "app", "(dashboard)");
  const paginas = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return paginas(path);
      return entry.name === "page.tsx" ? [path] : [];
    });

  for (const archivo of paginas(base)) {
    const ruta = `/${relative(base, archivo).split(sep).join("/")}`.replace(/\/?page\.tsx$/, "") || "/";
    if (ruta === "/[...slug]") continue;

    it(`${ruta} verifica la sesión y el permiso de su propia ruta`, () => {
      const codigo = readFileSync(archivo, "utf8");
      const conGuarda = codigo.includes(`requirePageAccess("${ruta}")`);
      const abierta = ABIERTAS_PAGINAS.includes(ruta) && codigo.includes("requireUser()");
      expect(conGuarda || abierta).toBe(true);
    });
  }

  // Cada pantalla espera la sesión en su primera línea. Entre dos pantallas de la misma
  // sección, el loading.tsx de (dashboard) queda arriba de lo compartido y no se muestra.
  const secciones = new Set(
    paginas(base)
      .map((archivo) => dirname(dirname(archivo)))
      .filter((dir) => dir.startsWith(base + sep)),
  );

  for (const seccion of secciones) {
    it(`${relative(base, seccion)} muestra el esqueleto al pasar entre sus pantallas`, () => {
      expect(existsSync(join(seccion, "loading.tsx"))).toBe(true);
    });
  }
});
