"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { BottomNav } from "@/components/bottom-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [hydrated, isAuthenticated, router])

  return (
    <div className="min-h-svh">
      <main className="pb-24 overflow-x-hidden">
        {/* Show spinner in content area while hydrating, nav always visible */}
        {!hydrated ? (
          <div className="min-h-[60svh] flex items-center justify-center">
            <div
              className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: "var(--app-accent)" }}
            />
          </div>
        ) : isAuthenticated ? (
          children
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
