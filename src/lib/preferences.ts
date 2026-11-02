import { siteConfig } from "@/config/site";

/**
 * Preferencias de UI persistidas en localStorage: tema y aside colapsado.
 *
 * La fuente de verdad son dos atributos en <html>:
 *   data-theme="light|dark"   → tokens de color (config/theme.css)
 *   data-sidebar="collapsed"  → ancho del aside (variante `sidebar-collapsed:`)
 *
 * Un script inline los aplica antes del primer paint (sin flash ni hydration
 * mismatch) y los stores de abajo los mantienen sincronizados con React.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Se inyecta en <head> desde el root layout. */
export function getPreferencesScript() {
  return `(function(){var d=document.documentElement,t=${JSON.stringify(siteConfig.defaultTheme)},c=false;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")||t;c=localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="true"}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("${DARK_QUERY}").matches?"dark":"light";d.dataset.theme=t;d.style.colorScheme=t;if(c)d.dataset.sidebar="collapsed"})()`;
}

/* -------------------------------------------------------------------------- */
/* Tema                                                                       */
/* -------------------------------------------------------------------------- */

const themeListeners = new Set<() => void>();
let themeCache: ThemePreference | null = null;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(value)) return value;
  } catch {}
  return siteConfig.defaultTheme;
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function emitTheme() {
  themeListeners.forEach((listener) => listener());
}

/**
 * Aplica el tema sin que cada elemento anime su transición de color.
 * Los elementos con `data-theme-transition` (ej. el ícono del toggle) sí animan.
 */
function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const resolved = resolveTheme(preference);
  const changed = root.dataset.theme !== resolved;

  let freeze: HTMLStyleElement | null = null;
  if (changed) {
    freeze = document.createElement("style");
    freeze.textContent =
      "*:not([data-theme-transition]),*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);
  }

  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  if (freeze) {
    const node = freeze;
    window.getComputedStyle(document.body);
    setTimeout(() => node.remove(), 1);
  }
}

export function getThemePreference(): ThemePreference {
  themeCache ??= readStoredTheme();
  return themeCache;
}

export function getResolvedTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setThemePreference(preference: ThemePreference) {
  themeCache = preference;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}
  applyTheme(preference);
  emitTheme();
}

export function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

/* -------------------------------------------------------------------------- */
/* Aside colapsado                                                            */
/* -------------------------------------------------------------------------- */

const sidebarListeners = new Set<() => void>();

function readStoredSidebar() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function applySidebar(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
}

function emitSidebar() {
  sidebarListeners.forEach((listener) => listener());
}

export function getSidebarCollapsed() {
  return document.documentElement.dataset.sidebar === "collapsed";
}

export function setSidebarCollapsed(collapsed: boolean) {
  applySidebar(collapsed);
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {}
  emitSidebar();
}

export function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

/* -------------------------------------------------------------------------- */
/* Sincronización                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Re-aplica los atributos. En desarrollo, Strict Mode remonta el árbol y React
 * limpia los atributos de <html> que no maneja; en producción es un no-op.
 */
export function restorePreferences() {
  applyTheme(getThemePreference());
  applySidebar(readStoredSidebar());
  emitTheme();
  emitSidebar();
}

/** Escucha cambios del tema del sistema y de otras pestañas. */
export function watchPreferences() {
  const media = window.matchMedia(DARK_QUERY);

  const onSystemChange = () => {
    if (getThemePreference() !== "system") return;
    applyTheme("system");
    emitTheme();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      themeCache = readStoredTheme();
      applyTheme(themeCache);
      emitTheme();
    }
    if (event.key === SIDEBAR_STORAGE_KEY) {
      applySidebar(event.newValue === "true");
      emitSidebar();
    }
  };

  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}
