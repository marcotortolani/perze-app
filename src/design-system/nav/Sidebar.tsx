"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "../core/Icon";
import { Logo } from "../core/Logo";
import type { TabItem } from "./TabBar";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";

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
  /** Último ítem del panel, después de "Más" — mismo flujo de confirmación que `/more`. */
  onSignOut?: (() => void) | undefined;
  signOutLabel?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

const navButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  height: 44,
  padding: "0 12px",
  borderRadius: "var(--radius-chip)",
  border: 0,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  // `minWidth: 0`: un hijo flex vale `min-width: auto` por default, que
  // ignora `text-overflow` en el `<span>` de abajo y lo empuja a wrappear
  // en dos líneas en vez de truncar — pasaba con labels largos ("Estado de
  // sincronización", "Reglas de autocategorización") en los `--sidebar-width`
  // angostos (248px).
  minWidth: 0,
  textDecoration: "none",
};

function NavButtonContent({ icon, label, on }: { icon: IconName; label: string; on: boolean }) {
  return (
    <>
      <Icon name={icon} size={20} strokeWidth={on ? 1.9 : 1.5} color={on ? "var(--primary-ink)" : "var(--text-secondary)"} style={{ flexShrink: 0 }} />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          fontWeight: 500,
          color: on ? "var(--text-primary)" : "var(--text-secondary)",
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </>
  );
}

/**
 * Fase 1 del plan de fluidez de navegación: con `href` renderiza
 * `<Link prefetch>` (el sidebar entero está siempre en viewport, así que
 * toda la navegación de escritorio queda prefetcheada apenas hidrata) — sin
 * `href` mantiene el `<button onClick>` de siempre.
 */
function NavButton({ icon, label, on, href, onClick }: { icon: IconName; label: string; on: boolean; href?: string | undefined; onClick: () => void }) {
  if (href) {
    return (
      <Link href={href} prefetch style={{ ...navButtonStyle, background: on ? "var(--surface-2)" : "transparent" }}>
        <NavButtonContent icon={icon} label={label} on={on} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={{ ...navButtonStyle, background: on ? "var(--surface-2)" : "transparent" }}>
      <NavButtonContent icon={icon} label={label} on={on} />
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
export function Sidebar({ tabs, groups, onNavigate, active, onChange, onAdd, onSignOut, signOutLabel, className, style }: SidebarProps) {
  const t = useTranslations();
  const navTabs = tabs.filter((tab) => !tab.fab);
  const { ref: navRef, overflowing } = useScrollOverflow<HTMLElement>();

  return (
    <aside
      // `scroll-fade-bottom`: mismo fade que `/accounts` (`globals.css`) sobre
      // el borde inferior del `<nav>` que scrollea. Tiene que ir en ESTE
      // contenedor (no-scrolleable) y no en `<nav>` — el pseudo-elemento se
      // ancla al `bottom:0` de acá, y por eso el padding-bottom que antes
      // vivía en este mismo `<aside>` se movió adentro de `<nav>` (ver más
      // abajo): si quedara acá, el fade gastaría la mayor parte de sus 32px
      // sobre el padding sólido en vez de sobre el contenido real — el corte
      // abrupto que se reportó.
      className={`scroll-fade-bottom ${className ?? ""}`.trim()}
      data-scroll-overflow={overflowing}
      style={{
        position: "relative",
        width: "var(--sidebar-width)",
        flexShrink: 0,
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        // Fondo opaco propio: sin esto, con el fondo de puntos (opt-in) encendido
        // en el `.app-shell` que lo contiene, la retícula se filtraría por acá —
        // el único hermano del shell sin `background: var(--page)` ya puesto.
        background: "var(--page)",
        borderRight: "1px solid var(--border)",
        padding: "24px 0 0",
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
        ref={navRef}
        aria-label={t("ds.sidebar.navLabel")}
        // `paddingBottom: 32` acá (no en `<aside>`): es el aire que evita que
        // el último ítem (o el botón de cerrar sesión) quede pegado contra
        // el borde real del scroller — el mismo que consume el fade de
        // `scroll-fade-bottom` de arriba.
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 16, padding: "0 16px 24px" }}
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
                <NavButton key={item.id} icon={item.icon} label={item.label} on={item.id === active} href={item.route} onClick={() => onNavigate?.(item.route)} />
              ))}
            </div>
          ))
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {navTabs.map((tab) => (
              <NavButton key={tab.id} icon={tab.icon} label={tab.label} on={tab.id === active} href={tab.href} onClick={() => onChange?.(tab.id)} />
            ))}
          </div>
        )}
        {onSignOut ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: "auto", paddingTop: 8 }}>
            <button type="button" onClick={onSignOut} style={{ ...navButtonStyle, background: "transparent" }}>
              <Icon name="sign-out" size={20} strokeWidth={1.5} color="var(--text-secondary)" />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>{signOutLabel}</span>
            </button>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
