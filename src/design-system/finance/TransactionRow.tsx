"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "../core/Icon";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";

export interface TransactionRowProps {
  icon?: IconName | undefined;
  merchant: string;
  /** "Cuenta · Categoría" — una línea, truncada. */
  meta?: string | undefined;
  value: Money;
  /** Monto convertido o en moneda original, en mono. */
  secondary?: string | undefined;
  polarity?: "positive" | "negative" | "negative-emphasis" | "neutral" | undefined;
  privacy?: boolean | undefined;
  /**
   * CON-14 (docs/plan-de-trabajo.md § 4): los 4 estados que le faltaban.
   * `pending` es `status='pending'` (un cargo todavía sin acreditar) —
   * DISTINTO del badge de `needs_fx` y del de "sin sincronizar", que son
   * otras dos cosas y no se confunden acá.
   */
  pending?: boolean | undefined;
  /** Repartido entre miembros del household (J5/J7). */
  shared?: boolean | undefined;
  /** Tiene foto de ticket u otro adjunto. */
  hasAttachment?: boolean | undefined;
  /** Cuota N de M — `null`/`undefined` si no es una compra en cuotas. */
  installment?: { number: number; total: number } | undefined;
  /** C12 — este movimiento no llegó al servidor tal cual está local: `conflict` = otro miembro lo editó a la vez; `rejected` = el servidor lo rechazó. Icono funcional, no decorativo — nunca se omite si el estado es real. */
  syncIssue?: "conflict" | "rejected" | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Un movimiento en la lista: ícono, comercio, cuenta/categoría, monto. Swipe izquierda borra, derecha edita. */
export function TransactionRow({
  icon = "cart",
  merchant,
  meta,
  value,
  secondary,
  polarity,
  privacy = false,
  pending = false,
  shared = false,
  hasAttachment = false,
  installment,
  syncIssue,
  onClick,
  style,
}: TransactionRowProps) {
  const t = useTranslations();
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "11px 0",
        cursor: onClick ? "pointer" : "default",
        transform: pressed && onClick ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          // pending: un cargo todavía sin acreditar — distinto del badge de
          // needs_fx y del de "sin sincronizar" (CON-14).
          boxShadow: pending ? "inset 0 0 0 1.5px var(--text-muted)" : "none",
        }}
      >
        <Icon name={icon} size={19} color="var(--text-secondary)" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 16, lineHeight: "22px", fontWeight: 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {merchant}
          </span>
          {hasAttachment ? <Icon name="receipt" size={13} color="var(--text-muted)" /> : null}
          {shared ? <Icon name="users" size={13} color="var(--text-muted)" /> : null}
          {syncIssue ? (
            <span title={t(`ds.transactionRow.syncIssue.${syncIssue}`)}>
              <Icon name="alert" size={13} color="var(--critical)" />
            </span>
          ) : null}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {meta ? (
            <span style={{ display: "block", fontSize: 13, lineHeight: "18px", color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {meta}
            </span>
          ) : null}
          {installment ? (
            <span style={{ fontSize: 12, lineHeight: "18px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
              {`${installment.number}/${installment.total}`}
            </span>
          ) : null}
        </span>
      </span>
      <span style={{ textAlign: "right", flexShrink: 0 }}>
        <Amount value={value} size="body" polarity={polarity} tabular privacy={privacy} style={{ display: "block" }} />
        {secondary ? (
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
            {secondary}
          </span>
        ) : null}
      </span>
    </div>
  );
}
