"use client";

import { useEffect, useLayoutEffect } from "react";
import { restorePreferences, watchPreferences } from "@/lib/preferences";

/** Mantiene tema y aside sincronizados con localStorage, el sistema y otras pestañas. */
export function PreferencesSync() {
  useLayoutEffect(() => {
    restorePreferences();
  }, []);

  useEffect(() => watchPreferences(), []);

  return null;
}
