import { Button } from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme } from "../theme";

/**
 * Botón primario del email: mismo criterio que el `Button` primario de la
 * app (`docs/02-design-system.md`) — alto 56px, ancho completo, radio
 * 16px, `#6D55F0` sobre `#FFFFFF` (4.99:1, AA). Sin sombra.
 */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "block",
        width: "100%",
        height: 56,
        lineHeight: "56px",
        textAlign: "center",
        backgroundColor: emailTheme.color.primaryFill,
        color: emailTheme.color.primaryOnFill,
        borderRadius: emailTheme.radius.button,
        fontFamily: emailTheme.fontStack,
        fontSize: 16,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}
