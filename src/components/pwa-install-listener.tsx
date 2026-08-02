"use client";

import { useEffect } from "react";
import { usePwaStore, type BeforeInstallPromptEvent } from "@/stores/pwa-store";

/**
 * Único listener de `beforeinstallprompt`/`appinstalled` de toda la app —
 * montado una vez en `Providers`. Guarda el evento en `usePwaStore` para
 * que Ajustes (K3) y el post-primer-gasto (A10) lo consuman sin cada uno
 * registrar su propio listener (el evento solo se dispara una vez; dos
 * listeners compitiendo por guardarlo es puro riesgo, ninguna ganancia).
 */
export function PwaInstallListener() {
  const setDeferredPrompt = usePwaStore((s) => s.setDeferredPrompt);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [setDeferredPrompt]);

  return null;
}
