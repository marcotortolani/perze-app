import { Button } from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme } from "../theme";

/**
 * Botón primario del email: mismo criterio que el `Button` primario de la
 * app (`docs/02-design-system.md`) — alto ~56px, ancho completo, radio
 * 16px, `#6D55F0` sobre `#FFFFFF` (4.99:1, AA). Sin sombra.
 *
 * El centrado vertical va por `padding`, no por `height`+`lineHeight`. El
 * `Button` de `@react-email/components` envuelve el texto en un `<span>`
 * interno con su propio `line-height:120%` (para el truco de Outlook) y
 * solo calcula el `mso-text-raise` que lo centra de verdad a partir del
 * `padding` — con `height`/`lineHeight` puestos en el `<a>` de afuera, ese
 * span interno queda con `vertical-align: baseline` en vez de centrado, y
 * el texto se ve corrido hacia arriba (bug visto en Gmail/preview real).
 */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "block",
        width: "100%",
        padding: "18px 0",
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
