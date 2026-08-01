"use client";

import { useEffect, useState } from "react";

/**
 * C7 — señal real de conectividad, por eventos `online`/`offline` del
 * navegador. Antes el `SyncDot` inferíaselo del outbox (`pending > 0 →
 * "offline"`), que es un heurístico falso: tener mutaciones encoladas
 * significa "hay algo por sincronizar", no "no hay red" — con conexión
 * real esas dos cosas conviven todo el tiempo mientras el drenaje corre.
 */
export function useOnlineStatus(): boolean {
  // `navigator` no existe en SSR — arranca "online" (el caso común). El
  // valor real ya queda bien apenas monta en el cliente (el `useState`
  // lazy corre en el primer render del cliente, no en el servidor), así
  // que no hace falta corregirlo de nuevo desde el efecto.
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
