"use client";

import { useTranslations } from "next-intl";
import { Sheet } from "@/design-system";
import type { AccountRow, TransactionRow } from "@/lib/db/schema";

export interface CurrencyPickerSheetProps {
  open: boolean;
  onClose: () => void;
  accounts: AccountRow[];
  transactions: TransactionRow[] | undefined;
  /** La moneda de la cuenta elegida — es la opción "sin conversión". */
  accountCurrency: string | undefined;
  /** `""` = misma que la cuenta (sin conversión de captura). */
  value: string;
  onChange: (currency: string) => void;
}

/**
 * En qué moneda se está tipeando el monto, cuando no es la de la cuenta.
 *
 * El caso que esto resuelve: pagar 4.200 pesos uruguayos con una tarjeta
 * emitida en dólares. Antes había que averiguar a mano cuántos dólares eran
 * — un dato que el usuario muchas veces ni ve — o cambiar de cuenta. Ahora
 * se tipea lo que dice el ticket y la conversión la hace la app
 * (`save-transaction.ts` la guarda en `original_amount`/`original_currency`/
 * `original_rate`, ver `CLAUDE.md` § "son dos conversiones, no una").
 *
 * **Las opciones salen del uso real, no del catálogo**: las monedas de las
 * cuentas del household más las que ya aparecieron en algún movimiento. Un
 * listado de 150 monedas para elegir entre las dos de siempre es ruido, y
 * este sheet se abre desde el keypad, en el medio del flujo de 5 segundos.
 *
 * Sin banderas, chip con el código (`CLAUDE.md` § decisiones de imagen): la
 * bandera es del país, no de la moneda, y se rompe sola con el dólar o el
 * euro.
 */
export function CurrencyPickerSheet({ open, onClose, accounts, transactions, accountCurrency, value, onChange }: CurrencyPickerSheetProps) {
  const t = useTranslations();

  const used = new Set<string>();
  for (const account of accounts) used.add(account.currencyCode);
  for (const tx of transactions ?? []) {
    used.add(tx.currencyCode);
    if (tx.originalCurrency) used.add(tx.originalCurrency);
  }
  if (accountCurrency) used.delete(accountCurrency);
  const options = [...used].sort();

  const selected = value || accountCurrency || "";

  return (
    <Sheet open={open} onClose={onClose} title={t("capture.currencySheetTitle")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {accountCurrency ? (
          <CurrencyRow
            code={accountCurrency}
            hint={t("capture.currencySameAsAccount")}
            selected={selected === accountCurrency}
            onClick={() => {
              // `""` y no el código: así el borrador sigue siguiendo a la
              // cuenta si después se cambia de cuenta, en vez de quedar
              // clavado en una moneda que ya no corresponde.
              onChange("");
              onClose();
            }}
          />
        ) : null}
        {options.map((code) => (
          <CurrencyRow
            key={code}
            code={code}
            selected={selected === code}
            onClick={() => {
              onChange(code);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

function CurrencyRow({ code, hint, selected, onClick }: { code: string; hint?: string | undefined; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        minHeight: 44,
        padding: "12px 14px",
        border: 0,
        borderRadius: "var(--radius-card)",
        background: selected ? "var(--selection-surface)" : "var(--surface-2)",
        boxShadow: selected ? "inset 0 0 0 1px var(--selection-ring)" : "none",
        color: "var(--text-primary)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 15 }}>{code}</span>
      {hint ? (
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      ) : null}
    </button>
  );
}
