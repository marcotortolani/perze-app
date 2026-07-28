"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";

export interface AccountSummary {
  id: string;
  institution: string;
  /** Tipo de cuenta, p. ej. "Caja de Ahorro". */
  name: string;
  balance: Money;
  country?: string | undefined;
}

export interface AccountCarouselProps {
  accounts: AccountSummary[];
  activeId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  privacy?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Carrusel horizontal con snap de cuentas: saldo, institución, moneda,
 * país. La cuenta activa se resuelve por superficie (surface-2), nunca
 * por relleno de marca.
 */
export function AccountCarousel({ accounts = [], activeId, onSelect, privacy = false, style }: AccountCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
  }, []);

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        padding: "0 var(--screen-padding)",
        margin: "0 calc(-1 * var(--screen-padding))",
        scrollPaddingInlineStart: "var(--screen-padding)",
        scrollbarWidth: "none",
        ...style,
      }}
    >
      {accounts.map((a) => {
        const on = a.id === activeId;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect?.(a.id)}
            style={{
              scrollSnapAlign: "start",
              flex: "0 0 auto",
              width: 208,
              textAlign: "left",
              cursor: "pointer",
              background: on ? "var(--surface-2)" : "var(--surface-1)",
              borderRadius: "var(--radius-card)",
              padding: 16,
              border: 0,
              transition: "background var(--duration-fast) var(--ease-spring-snappy)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.institution}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{a.balance.currency}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Amount value={a.balance} size="body" showSign={false} polarity="neutral" privacy={privacy} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
              {a.name}
              {a.country ? ` · ${a.country}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
