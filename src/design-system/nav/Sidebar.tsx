"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "../core/Icon";
import { Logo } from "../core/Logo";
import type { TabItem } from "./TabBar";

export interface SidebarNavItem {
  id: string;
  route: string;
  icon: IconName;
  label: string;
}

export interface SidebarNavGroup {
  id: string;
  caption?: string | undefined;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  tabs: TabItem[];
  /**
   * Navegación agrupada de escritorio (ver `buildDesktopNav` en
   * `src/lib/nav/desktop-nav.ts`). Cuando está presente reemplaza el
   * render por `tabs` — que solo trae los 4 slots del móvil — para
   * aprovechar el alto disponible. `onNavigate` recibe la `route`, no el
   * `id` (a diferencia de `onChange`, pensado para los tabs de `TabItem`).
   */
  groups?: SidebarNavGroup[] | undefined;
  onNavigate?: ((route: string) => void) | undefined;
  active?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
  onAdd?: (() => void) | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

function NavButton({ icon, label, on, onClick }: { icon: IconName; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 44,
        padding: "0 12px",
        borderRadius: "var(--radius-chip)",
        border: 0,
        background: on ? "var(--surface-2)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <Icon name={icon} size={20} strokeWidth={on ? 1.9 : 1.5} color={on ? "var(--primary-ink)" : "var(--text-secondary)"} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {label}
      </span>
    </button>
  );
}

/**
 * Navegación de escritorio — a partir de 1024px (`lg`) reemplaza la
 * `TabBar` inferior, que queda oculta (ver `(app)/layout.tsx`). El FAB deja
 * de tener sentido como elemento flotante en un layout de escritorio: acá
 * es un botón normal, primero en la lista. La visibilidad (`hidden lg:flex`)
 * la decide quien lo usa vía `className` — este componente no fija `display`.
 *
 * Cabecera fija (logo + botón agregar) más `<nav>` con scroll propio e
 * independiente del contenido — el `<aside>` no scrollea, así que nunca se
 * va con la página.
 */
export function Sidebar({ tabs, groups, onNavigate, active, onChange, onAdd, className, style }: SidebarProps) {
  const t = useTranslations();
  const navTabs = tabs.filter((tab) => !tab.fab);

  return (
    <aside
      className={className}
      style={{
        width: "var(--sidebar-width)",
        flexShrink: 0,
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        borderRight: "1px solid var(--border)",
        padding: "24px 0",
        ...style,
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 24, padding: "0 16px 24px" }}>
        <div style={{ padding: "0 8px" }}>
          <Logo />
        </div>

        <button
          type="button"
          onClick={onAdd}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 44,
            borderRadius: "var(--radius-button)",
            border: 0,
            background: "var(--primary-fill)",
            color: "var(--primary-on-fill)",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Icon name="plus" size={18} strokeWidth={2} />
          {t("ds.tabBar.add")}
        </button>
      </div>

      <nav
        aria-label={t("ds.sidebar.navLabel")}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 24, padding: "0 16px" }}
      >
        {groups ? (
          groups.map((group) => (
            <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.caption ? (
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    lineHeight: "16px",
                    fontWeight: 600,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    padding: "0 12px 4px",
                  }}
                >
                  {group.caption}
                </div>
              ) : null}
              {group.items.map((item) => (
                <NavButton key={item.id} icon={item.icon} label={item.label} on={item.id === active} onClick={() => onNavigate?.(item.route)} />
              ))}
            </div>
          ))
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {navTabs.map((tab) => (
              <NavButton key={tab.id} icon={tab.icon} label={tab.label} on={tab.id === active} onClick={() => onChange?.(tab.id)} />
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
