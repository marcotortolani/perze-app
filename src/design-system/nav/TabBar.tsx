"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "../core/Icon";

export interface TabItem {
  id: string;
  label: string;
  icon: IconName;
  /** El slot central: un FAB de 64px superpuesto, no un tab. */
  fab?: boolean | undefined;
}

export interface TabBarProps {
  /** Por defecto Inicio · Movimientos · [+] · Análisis · Más. Los módulos apagados nunca aparecen. */
  tabs?: TabItem[] | undefined;
  active?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Tab bar inferior de 64px con el FAB en el slot central. */
export function TabBar({ tabs, active, onChange, style }: TabBarProps) {
  const t = useTranslations();
  const [pressed, setPressed] = useState<string | null>(null);
  const items: TabItem[] =
    tabs ??
    [
      { id: "home", label: t("nav.home"), icon: "home" },
      { id: "movements", label: t("nav.movementsShort"), icon: "list" },
      { id: "add", label: "", icon: "plus", fab: true },
      { id: "analytics", label: t("nav.analysis"), icon: "chart" },
      { id: "more", label: t("nav.more"), icon: "more" },
    ];
  return (
    <nav style={{ height: "var(--tabbar-height)", display: "flex", alignItems: "center", background: "var(--page)", paddingBottom: "env(safe-area-inset-bottom)", ...style }}>
      {items.map((item) => {
        const on = item.id === active;
        if (item.fab) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              aria-label={t("ds.tabBar.add")}
              onPointerDown={() => setPressed(item.id)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              style={{ flex: 1, display: "flex", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}
            >
              <span
                style={{
                  width: "var(--fab-size)",
                  height: "var(--fab-size)",
                  borderRadius: 999,
                  background: "var(--primary-fill)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-sheet)",
                  transform: `translateY(-18px) scale(${pressed === item.id ? "var(--press-scale)" : "1"})`,
                  transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
                }}
              >
                <Icon name="plus" size={28} strokeWidth={2} color="var(--primary-on-fill)" />
              </span>
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange?.(item.id)}
            style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: 0, cursor: "pointer" }}
          >
            <Icon name={item.icon} size={22} strokeWidth={on ? 1.9 : 1.5} color={on ? "var(--primary-ink)" : "var(--text-muted)"} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500, color: on ? "var(--primary-ink)" : "var(--text-muted)" }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
