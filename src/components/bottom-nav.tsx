"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, ArrowLeftRight, Plus, BarChart3, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const LEFT_ITEMS = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/movimientos", icon: ArrowLeftRight, label: "Movimientos" },
] as const

const RIGHT_ITEMS = [
  { href: "/analisis", icon: BarChart3, label: "Análisis" },
  { href: "/configuracion", icon: Settings, label: "Ajustes" },
] as const

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 h-full pt-1",
        "transition-colors duration-200",
        active
          ? "text-[var(--app-accent)]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {/* Active indicator bar — appears above icon when active */}
      <span
        className={cn(
          "block h-[3px] rounded-full transition-all duration-300",
          active
            ? "w-5 bg-[var(--app-accent)]"
            : "w-0 bg-transparent"
        )}
        aria-hidden="true"
      />
      <Icon
        className={cn(
          "size-[1.375rem] transition-all duration-200",
          active && "scale-110"
        )}
        strokeWidth={active ? 2.5 : 1.75}
      />
      <span
        className={cn(
          "text-[10px] leading-none tracking-wide",
          active ? "font-semibold" : "font-medium"
        )}
      >
        {label}
      </span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string) {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  function handleAdd() {
    router.push("/movimientos?new=true")
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "backdrop-blur-xl",
        "flex items-stretch justify-around",
        "h-[4.5rem]"
      )}
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "color-mix(in oklch, var(--card) 98%, var(--app-accent) 2%)",
        borderTop: "1.5px solid color-mix(in oklch, var(--app-accent) 20%, var(--border))",
        boxShadow: "0 -8px 30px oklch(0 0 0 / 0.12)",
      }}
    >
      {/* Left nav items */}
      {LEFT_ITEMS.map(({ href, icon, label }) => (
        <NavItem
          key={href}
          href={href}
          icon={icon}
          label={label}
          active={isActive(href)}
        />
      ))}

      {/* Center FAB */}
      <div className="flex flex-col items-center justify-center flex-1 h-full">
        <button
          onClick={handleAdd}
          aria-label="Agregar movimiento"
          className={cn(
            "size-[3.25rem] rounded-full",
            "bg-[var(--app-accent)] text-[var(--app-accent-foreground)]",
            "flex items-center justify-center",
            "shadow-lg",
            "active:scale-95 transition-all duration-150",
            "-mt-6"
          )}
          style={{
            boxShadow:
              "0 4px 20px color-mix(in oklch, var(--app-accent) 40%, transparent), 0 2px 8px color-mix(in oklch, var(--app-accent) 25%, transparent)",
          }}
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </button>
      </div>

      {/* Right nav items */}
      {RIGHT_ITEMS.map(({ href, icon, label }) => (
        <NavItem
          key={href}
          href={href}
          icon={icon}
          label={label}
          active={isActive(href)}
        />
      ))}
    </nav>
  )
}
