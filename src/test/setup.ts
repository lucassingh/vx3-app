import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// La API simulada responde al instante y sin fallas en los tests.
process.env.MOCK_API_DELAY_MS = "0";
process.env.MOCK_API_FAILURE_RATE = "0";

if (typeof window !== "undefined") {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.sidebar;
  });

  // APIs del navegador que jsdom no implementa y usan Radix o el layout.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
}
