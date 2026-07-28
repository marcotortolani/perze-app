"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../core/Icon";
import { Logo } from "../core/Logo";
import type { TabItem } from "./TabBar";

export interface SidebarProps {
  tabs: TabItem[];
  active?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
  onAdd?: (() => void) | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Navegación de escritorio — a partir de tablet (`md`) reemplaza la
 * `TabBar` inferior, que queda oculta (ver `(app)/layout.tsx`). El FAB deja
 * de tener sentido como elemento flotante en un layout de escritorio: acá
 * es un botón normal, primero en la lista. La visibilidad (`hidden md:flex`)
 * la decide quien lo usa vía `className` — este componente no fija `display`.
 */
export function Sidebar({ tabs, active, onChange, onAdd, className, style }: SidebarProps) {
  const t = useTranslations();
  const navTabs = tabs.filter((tab) => !tab.fab);

  return (
    <aside
      className={className}
      style={{
        width: "var(--sidebar-width)",
        flexShrink: 0,
        flexDirection: "column",
        gap: 24,
        padding: "24px 16px",
        borderRight: "1px solid var(--border)",
        ...style,
      }}
    >
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

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navTabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange?.(tab.id)}
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
              }}
            >
              <Icon name={tab.icon} size={20} strokeWidth={on ? 1.9 : 1.5} color={on ? "var(--primary-ink)" : "var(--text-secondary)"} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
