import { describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/config/site";
import {
  getPreferencesScript,
  getSidebarCollapsed,
  setSidebarCollapsed,
  setThemePreference,
  SIDEBAR_STORAGE_KEY,
  subscribeTheme,
  THEME_STORAGE_KEY,
} from "./preferences";

const root = document.documentElement;
const runInlineScript = () => new Function(getPreferencesScript())();

describe("script inline de preferencias", () => {
  it("aplica el tema y el aside guardados antes de hidratar", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");

    runInlineScript();

    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(root.dataset.sidebar).toBe("collapsed");
  });

  it("sin preferencia guardada usa el tema por defecto", () => {
    runInlineScript();

    // El mock de matchMedia del setup simula un sistema en modo claro.
    const expected = siteConfig.defaultTheme === "system" ? "light" : siteConfig.defaultTheme;
    expect(root.dataset.theme).toBe(expected);
    expect(root.dataset.sidebar).toBeUndefined();
  });
});

describe("stores", () => {
  it("setThemePreference persiste, aplica el tema y avisa a los suscriptores", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setThemePreference("dark");

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("setSidebarCollapsed alterna el atributo y lo persiste", () => {
    setSidebarCollapsed(true);
    expect(getSidebarCollapsed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("true");

    setSidebarCollapsed(false);
    expect(root.dataset.sidebar).toBeUndefined();
  });
});
