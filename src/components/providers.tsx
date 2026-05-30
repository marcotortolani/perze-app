"use client"

import { useEffect } from "react"
import { useSettingsStore } from "@/stores/settings-store"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme, accentColor } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement

    // Apply theme
    root.classList.remove("dark", "light")
    if (theme === "dark") {
      root.classList.add("dark")
    } else if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (prefersDark) root.classList.add("dark")
    }
    // "light" needs no class

    // Apply accent
    root.classList.remove(
      "accent-emerald",
      "accent-violet",
      "accent-blue",
      "accent-rose",
      "accent-amber"
    )
    root.classList.add(`accent-${accentColor}`)
  }, [theme, accentColor])

  // Also listen for system theme changes when mode is "system"
  useEffect(() => {
    if (theme !== "system") return

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement
      root.classList.remove("dark", "light")
      if (e.matches) root.classList.add("dark")
    }

    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  return (
    <>
      {children}
      <Toaster richColors position="top-center" />
    </>
  )
}
