"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
// C14/auditoría: el barrel `@phosphor-icons/react` referencia >9.000 íconos;
// este `<Toaster>` vive en el árbol raíz (`providers.tsx`), así que ese
// barrel entero terminaba en el bundle inicial aunque el usuario nunca
// abriera una pantalla con más íconos. El resto del design system ya usa
// el subpath `dist/ssr` (ver `design-system/core/Icon.tsx`) — acá faltaba.
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, XCircleIcon, CircleNotchIcon } from "@phosphor-icons/react/dist/ssr"
import { useResolvedTheme } from "@/lib/theme/use-resolved-theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useResolvedTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon weight="fill" className="size-4" />
        ),
        info: (
          <InfoIcon weight="fill" className="size-4" />
        ),
        warning: (
          <WarningCircleIcon weight="fill" className="size-4" />
        ),
        error: (
          <XCircleIcon weight="fill" className="size-4" />
        ),
        loading: (
          <CircleNotchIcon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--surface-2)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
