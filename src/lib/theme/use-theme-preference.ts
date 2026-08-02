"use client";

import { useEffect, useState } from "react";
import { getStoredThemePreference } from "./apply-theme";
import type { ThemePreference } from "./constants";

/**
 * Preferencia guardada (no la resuelta — para eso está `useResolvedTheme`).
 * `"system"` por default en el primer render de servidor; se corrige post-mount
 * porque `localStorage` no existe en SSR.
 */
export function useThemePreference(): ThemePreference {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura genuina de localStorage, no derivable en SSR.
    setPref(getStoredThemePreference());
  }, []);

  return pref;
}
