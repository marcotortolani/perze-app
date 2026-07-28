"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, XCircleIcon, CircleNotchIcon } from "@phosphor-icons/react"
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
