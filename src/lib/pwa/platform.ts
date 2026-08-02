/**
 * Detección de plataforma para el flujo de instalación de Ajustes (K3) —
 * cada una tiene un proceso distinto: Android/Windows/macOS con Chrome o
 * Edge disparan `beforeinstallprompt` (ver `pwa-store.ts`); iOS nunca lo
 * dispara y necesita instrucciones manuales (Compartir → Agregar a inicio);
 * macOS/Windows sin ese evento (Firefox, Safari de escritorio) caen a
 * instrucciones genéricas por navegador.
 */
export type InstallPlatform = "ios" | "android" | "macos" | "windows" | "other";

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  return "other";
}

/**
 * Ya instalada — `display-mode: standalone` cubre Android/desktop, la
 * bandera `navigator.standalone` es el equivalente específico de iOS
 * Safari (no estandarizado, por eso no está en el tipo `Navigator`).
 */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}
