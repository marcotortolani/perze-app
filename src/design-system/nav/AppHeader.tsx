import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { SegmentedControl } from "../core/SegmentedControl";
import { SyncDot } from "./SyncDot";

export interface AppHeaderProps {
  /** Título de pantalla; se omite en el dashboard, donde el scope switcher es el título. */
  title?: string | undefined;
  scope?: string | undefined;
  onScopeChange?: ((scope: string) => void) | undefined;
  scopeOptions?: string[] | undefined;
  onSearch?: (() => void) | undefined;
  /** Presente en pantallas empujadas: dibuja un control de volver de 44px y oculta el scope switcher. */
  onBack?: (() => void) | undefined;
  /** Requerido cuando `onBack` está presente — lo resuelve el caller vía `useTranslations`. */
  backLabel?: string | undefined;
  /** Requerido cuando `onSearch` está presente — lo resuelve el caller vía `useTranslations`. */
  searchLabel?: string | undefined;
  /** El buscador flotante que abre `onSearch` está montado y visible. */
  searchExpanded?: boolean | undefined;
  syncState?: "synced" | "syncing" | "offline" | undefined;
  pending?: number | undefined;
  showScope?: boolean | undefined;
  right?: ReactNode | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Header de 56px: [scope switcher] — [título] — [buscar] [SyncDot]. Sin
 * borde, sin sombra. El scope switcher es `SegmentedControl` con
 * `emphasis="brand"` directo (el scope es identidad de datos, el único
 * caso que gasta relleno de marca) — no un componente `ScopeSwitcher`
 * aparte, que quedó como alias trivial y se dio de baja.
 */
export function AppHeader({
  title,
  scope,
  onScopeChange,
  scopeOptions,
  onSearch,
  onBack,
  backLabel,
  searchLabel,
  searchExpanded = false,
  syncState = "synced",
  pending = 0,
  showScope = true,
  right,
  style,
}: AppHeaderProps) {
  return (
    <header style={{ height: "var(--header-height)", display: "flex", alignItems: "center", gap: 12, padding: "0 var(--screen-padding)", background: "var(--page)", ...style }}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          style={{ width: 44, height: 44, marginLeft: -12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}
        >
          <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
        </button>
      ) : null}
      {showScope && !onBack && scopeOptions ? (
        <SegmentedControl options={scopeOptions} value={scope} onChange={onScopeChange} size="sm" emphasis="brand" />
      ) : null}
      {title ? <div style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-primary)" }}>{title}</div> : null}
      <div style={{ flex: 1 }} />
      {right}
      {onSearch ? (
        <button
          type="button"
          onClick={onSearch}
          aria-label={searchLabel}
          aria-haspopup="dialog"
          aria-expanded={searchExpanded}
          style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer", marginRight: -10 }}
        >
          <Icon name="search" size={20} color="var(--text-secondary)" />
        </button>
      ) : null}
      <SyncDot state={syncState} pending={pending} />
    </header>
  );
}
