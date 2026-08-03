"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";

export interface AccountSummary {
  id: string;
  institution: string;
  /** Tipo de cuenta, p. ej. "Caja de Ahorro". */
  name: string;
  balance: Money;
  country?: string | undefined;
  /**
   * CON-15: cuentas de broker en dos monedas (ej. saldo en pesos + saldo en
   * dólares de la misma cuenta) — el caller arma el segundo `<Amount>` ya
   * formateado, este componente no sabe de brokers ni decide cuándo
   * corresponde mostrarlo.
   */
  secondaryBalance?: ReactNode | undefined;
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
      // Sin mouse/trackpad horizontal, un usuario de desktop con más
      // cuentas de las que entran no tenía forma de ver el resto: la
      // rueda vertical del mouse no mueve un `overflow-x: auto` solo, y el
      // scrollbar está oculto a propósito (`scrollbarWidth: none`, es el
      // look de un carrusel con snap, no el de una lista con scrollbar).
      // Traduce la rueda vertical a horizontal SOLO cuando el gesto viene
      // predominantemente en vertical (un trackpad que ya manda `deltaX`
      // sigue scrolleando nativo, sin este handler pisándolo).
      onWheel={(e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const el = ref.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }}
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
              background: on ? "var(--selection-surface)" : "var(--surface-1)",
              borderRadius: "var(--radius-card)",
              padding: 16,
              border: 0,
              boxShadow: on ? "inset 0 0 0 1px var(--selection-ring)" : "none",
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
              {a.secondaryBalance ? (
                <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-muted)" }}>
                  {a.secondaryBalance}
                </div>
              ) : null}
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
