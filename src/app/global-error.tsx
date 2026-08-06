"use client";

import { useEffect } from "react";

/**
 * Red de seguridad de último recurso — solo se monta si el layout raíz
 * mismo falla (Providers/IntlBoundary incluidos), así que reemplaza
 * `<html>`/`<body>` enteros y no tiene acceso a next-intl ni a los
 * tokens de `globals.css` (nada de eso puede darse por sentado acá, es
 * justo lo que puede haber roto). Texto fijo en español, a propósito:
 * es la única pantalla de la app donde `CLAUDE.md` § i18n no aplica —
 * no hay forma de pedirle un locale a un provider que no montó.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#0A0A0B",
          color: "#FAFAF9",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 16, maxWidth: "32ch" }}>Algo falló y la app no pudo arrancar.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: 56,
            padding: "0 24px",
            borderRadius: 16,
            border: 0,
            background: "#6D55F0",
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
