"use client";

import { createContext, useContext, useLayoutEffect } from "react";
import type { ReactNode } from "react";

export interface PageHeaderConfig {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}

/**
 * Único puente entre una página y el `AppHeader` que vive en
 * `(app)/layout.tsx` — la página nunca renderiza el header, solo declara
 * qué le corresponde mostrar (título, volver, slot extra), igual que
 * `generateMetadata` para el `<title>` del documento, pero para UI
 * interactiva que sí necesita handlers.
 */
export const PageHeaderContext = createContext<(config: PageHeaderConfig | null) => void>(() => {});

/**
 * Sin dependencias en el efecto: si `title` llega async (el nombre de una
 * cuenta que todavía está cargando), cada render vuelve a registrar el
 * config actualizado sin arrastrar closures viejas de `onBack`. Sin
 * cleanup al desmontar, a propósito — en una transición de ruta el efecto
 * de la página NUEVA puede correr antes o después del cleanup de la
 * vieja, y un cleanup que pone `null` puede pisar el header recién
 * puesto. Toda ruta de `(app)/` llama este hook, así que siempre hay un
 * config fresco sobrescribiendo al anterior de inmediato.
 */
export function usePageHeader(config: PageHeaderConfig): void {
  const setConfig = useContext(PageHeaderContext);
  useLayoutEffect(() => {
    setConfig(config);
  });
}
