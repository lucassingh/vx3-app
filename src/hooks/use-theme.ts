"use client";

import { useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";
import {
  getResolvedTheme,
  getThemePreference,
  setThemePreference,
  subscribeTheme,
} from "@/lib/preferences";

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    () => siteConfig.defaultTheme,
  );
  const resolvedTheme = useSyncExternalStore(
    subscribeTheme,
    getResolvedTheme,
    () => null,
  );

  return { theme, resolvedTheme, setTheme: setThemePreference };
}
