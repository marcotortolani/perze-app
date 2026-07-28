"use client";

import { useEffect, useState } from "react";

/**
 * Tema resuelto en el DOM ahora mismo: `.light` en `<html>` = claro,
 * ausente = oscuro (el sistema es dark-first, ver `globals.css`). Reactivo
 * a cambios de clase (el futuro selector de tema de K3 los hace) y al
 * cambio de preferencia del sistema operativo cuando el usuario está en
 * "system" (sin clase explícita en ninguno de los dos storages).
 */
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document === "undefined"
      ? "dark"
      : document.documentElement.classList.contains("light")
        ? "light"
        : "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.classList.contains("light") ? "light" : "dark");

    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", read);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", read);
    };
  }, []);

  return theme;
}
