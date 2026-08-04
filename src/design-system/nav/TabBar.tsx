"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link, { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "../core/Icon";

export interface TabItem {
  id: string;
  label: string;
  icon: IconName;
  /** El slot central: un FAB de 64px superpuesto, no un tab. */
  fab?: boolean | undefined;
  /**
   * CON-13: contador visible sobre el ícono (ej. invitaciones pendientes
   * en "Más"). `aria-label` propio, nunca solo el número — un lector de
   * pantalla no adivina qué cuenta un punto de color.
   */
  badge?: number | undefined;
  badgeLabel?: string | undefined;
  /**
   * Fase 1 del plan de fluidez de navegación: con `href` presente, el tab
   * se renderiza como `<Link prefetch>` en vez de `<button onClick>` — la
   * tab bar está siempre en viewport, así que las cuatro rutas quedan
   * prefetcheadas apenas hidrata, y el tap navega desde el router cache
   * del cliente en vez de pedir el payload recién al tocar. Sin `href`
   * (uso fuera del shell, p. ej. `/dev/components`) se mantiene el
   * `<button>` de siempre — no es un cambio de contrato, es un modo
   * adicional.
   */
  href?: string | undefined;
}

export interface TabBarProps {
  /**
   * Por defecto Inicio · Movimientos · [+] · Análisis · Más. Los módulos
   * apagados nunca aparecen. CON-13: el 4to slot (hoy "Análisis" en el
   * default) lo elige el usuario — este componente no decide la
   * preferencia, solo renderiza lo que el caller arme; leer
   * `household.settings` y armar el array correspondiente es trabajo de
   * quien monta el shell de la app (K3 en adelante), no de este componente.
   */
  tabs?: TabItem[] | undefined;
  active?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Ícono + label de un tab, compartido entre el modo `<Link>` y `<button>`. `withPendingOpacity` solo se pasa `true` dentro de un `<Link>` — `useLinkStatus` no es válido fuera de uno. */
function TabIconLabel({ item, on, opacity }: { item: TabItem; on: boolean; opacity?: number }) {
  const t = useTranslations();
  return (
    <>
      <span style={{ position: "relative", display: "inline-flex" }}>
        <Icon name={item.icon} size={22} strokeWidth={on ? 1.9 : 1.5} color={on ? "var(--primary-ink)" : "var(--text-muted)"} style={opacity !== undefined ? { opacity } : undefined} />
        {item.badge !== undefined && item.badge > 0 ? (
          <span
            role="status"
            aria-label={item.badgeLabel ?? t("ds.tabBar.badgeCount", { count: item.badge })}
            style={{
              position: "absolute",
              top: -4,
              right: -8,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--critical)",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 700,
              lineHeight: "16px",
              textAlign: "center",
            }}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        ) : null}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500, color: on ? "var(--primary-ink)" : "var(--text-muted)" }}>{item.label}</span>
    </>
  );
}

/** Wrapper que solo existe para poder llamar `useLinkStatus` dentro del `<Link>` — el hook no funciona fuera de uno. */
function LinkTabIconLabel({ item, on }: { item: TabItem; on: boolean }) {
  const { pending } = useLinkStatus();
  return <TabIconLabel item={item} on={on} opacity={pending ? 0.6 : 1} />;
}

/** Tab bar inferior de 64px con el FAB en el slot central. */
export function TabBar({ tabs, active, onChange, style }: TabBarProps) {
  const t = useTranslations();
  const [pressed, setPressed] = useState<string | null>(null);
  // Activo optimista: `active` viene derivado de `usePathname()` en el
  // caller, así que solo cambia cuando la navegación ya commiteó. Pintar
  // el tab tocado como activo desde el tap (y no esperar el commit) es lo
  // que hace que la interfaz responda en el mismo frame. Se descarta
  // ajustando el estado durante el render (patrón de React, no un efecto)
  // en cuanto `active` alcanza al tab pendiente.
  const [pendingActive, setPendingActive] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState(active);
  if (active !== lastActive) {
    setLastActive(active);
    if (pendingActive !== null) setPendingActive(null);
  }
  const effectiveActive = pendingActive ?? active;

  const items: TabItem[] =
    tabs ??
    [
      { id: "home", label: t("nav.home"), icon: "squares-four" },
      { id: "movements", label: t("nav.movementsShort"), icon: "list" },
      { id: "add", label: "", icon: "plus", fab: true },
      { id: "analytics", label: t("nav.analysis"), icon: "chart" },
      { id: "more", label: t("nav.more"), icon: "more" },
    ];

  const buttonStyle: CSSProperties = { flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: 0, cursor: "pointer", textDecoration: "none" };

  return (
    <nav
      style={{
        height: "var(--tabbar-total-height)",
        paddingBottom: "var(--safe-bottom)",
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        background: "var(--page)",
        // Mismo color que la página de atrás — sin este hairline no se ve
        // dónde empieza el tab bar.
        borderTop: "var(--border-hairline) solid var(--border)",
        ...style,
      }}
    >
      {items.map((item) => {
        const on = item.id === effectiveActive;
        const handlePress = () => {
          setPressed(item.id);
          if (item.href && item.id !== active) setPendingActive(item.id);
        };
        if (item.fab) {
          const fabInner = (
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
          );
          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch
                aria-label={t("ds.tabBar.add")}
                onPointerDown={handlePress}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                style={{ flex: 1, display: "flex", justifyContent: "center", background: "none", border: 0, cursor: "pointer", textDecoration: "none" }}
              >
                {fabInner}
              </Link>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              aria-label={t("ds.tabBar.add")}
              onPointerDown={handlePress}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              style={{ flex: 1, display: "flex", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}
            >
              {fabInner}
            </button>
          );
        }
        const scale = pressed === item.id ? "var(--press-scale)" : "1";
        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch
              onPointerDown={handlePress}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              style={{ ...buttonStyle, transform: `scale(${scale})`, transition: "transform var(--duration-fast) var(--ease-spring-snappy)" }}
            >
              <LinkTabIconLabel item={item} on={on} />
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange?.(item.id)}
            onPointerDown={handlePress}
            onPointerUp={() => setPressed(null)}
            onPointerLeave={() => setPressed(null)}
            style={{ ...buttonStyle, transform: `scale(${scale})`, transition: "transform var(--duration-fast) var(--ease-spring-snappy)" }}
          >
            <TabIconLabel item={item} on={on} />
          </button>
        );
      })}
    </nav>
  );
}
