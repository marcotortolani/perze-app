"use client";

import { useEffect, useState } from "react";
import { getStoredBackdropPreference, type BackdropPreference } from "./apply-backdrop";
import { BACKDROP_DENSITY_DEFAULT, BACKDROP_INTENSITY_DEFAULT } from "./constants";

const SSR_DEFAULT: BackdropPreference = { enabled: false, density: BACKDROP_DENSITY_DEFAULT, intensity: BACKDROP_INTENSITY_DEFAULT };

/**
 * Preferencia guardada del fondo de puntos, para la pantalla de Ajustes.
 * Apagada por default en el primer render de servidor; se corrige
 * post-mount porque `localStorage` no existe en SSR — mismo patrón que
 * `useThemePreference()` (`src/lib/theme/use-theme-preference.ts`).
 */
export function useBackdropPreference(): BackdropPreference {
  const [pref, setPref] = useState<BackdropPreference>(SSR_DEFAULT);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura genuina de localStorage, no derivable en SSR.
    setPref(getStoredBackdropPreference());
  }, []);

  return pref;
}
