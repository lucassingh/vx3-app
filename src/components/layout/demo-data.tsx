"use client";

import { createContext, use } from "react";

const DemoDataContext = createContext(false);

/** Si algún dominio de la API sigue simulado. Lo decide el layout, en el servidor (API_REAL_DOMAINS). */
export function DemoDataProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <DemoDataContext value={value}>{children}</DemoDataContext>;
}

export function useDemoData() {
  return use(DemoDataContext);
}
