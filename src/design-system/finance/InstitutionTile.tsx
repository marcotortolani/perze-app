"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "../core/Icon";

export interface InstitutionTileProps {
  name: string;
  logoUrl?: string | null | undefined;
  /** Ícono genérico cuando no hay logo — "bank" o "wallet" según el tipo. */
  fallbackIcon?: IconName | undefined;
  selected?: boolean | undefined;
  onClick?: () => void | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Preset de banco/billetera con slot de logo — A6 (primera cuenta), E3
 * (crear cuenta). Sin esto, bancos distintos con el mismo ícono genérico
 * ("bank"/"wallet") se veían igual entre sí.
 */
export function InstitutionTile({ name, logoUrl, fallbackIcon = "bank", selected = false, onClick, style }: InstitutionTileProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderRadius: "var(--radius-card)",
        border: `1px solid ${selected ? "var(--border)" : "transparent"}`,
        background: selected ? "var(--surface-3)" : "var(--surface-2)",
        cursor: "pointer",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear",
        ...style,
      }}
    >
      <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo remoto de institución, sin control de dominio para next/image
          <img src={logoUrl} alt="" width={28} height={28} style={{ objectFit: "contain" }} />
        ) : (
          <Icon name={fallbackIcon} size={22} color="var(--text-secondary)" />
        )}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textAlign: "center" }}>{name}</span>
    </button>
  );
}
