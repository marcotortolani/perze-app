"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export interface InstitutionTileProps {
  name: string;
  /** `institutions.color` — obligatorio: el monograma se pinta sobre este color, nunca sobre un slot de datos ni violeta. */
  color: string;
  /**
   * `institutions.logo_url` — slot opcional para quien quiera poner logos
   * reales en una carpeta local ignorada por git (CLAUDE.md § imagen). Los
   * presets del catálogo global NUNCA lo traen: el logo real de un banco de
   * terceros no se distribuye en el repo, así que sin este campo el
   * monograma es el único rendering posible, no un fallback.
   */
  logoUrl?: string | null | undefined;
  selected?: boolean | undefined;
  onClick?: () => void | undefined;
  style?: CSSProperties | undefined;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

/**
 * CON-29: baldosa de banco/billetera — dos letras sobre `institutions.color`,
 * nunca el logo real de un tercero. A6 (primera cuenta), E1/E3 (cuentas).
 */
export function InstitutionTile({ name, color, logoUrl, selected = false, onClick, style }: InstitutionTileProps) {
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
        border: `1px solid ${selected ? "var(--selection-ring)" : "transparent"}`,
        background: selected ? "var(--selection-surface)" : "var(--surface-2)",
        cursor: "pointer",
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear",
        ...style,
      }}
    >
      <span style={{ width: 44, height: 44, borderRadius: 12, background: color, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- override local del usuario, nunca un preset del catálogo; sin control de dominio para next/image
          <img src={logoUrl} alt="" width={28} height={28} style={{ objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", fontFamily: "var(--font-sans)" }}>{initials(name)}</span>
        )}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", textAlign: "center" }}>{name}</span>
    </button>
  );
}
