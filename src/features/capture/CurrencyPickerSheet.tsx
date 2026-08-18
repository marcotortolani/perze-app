"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Sheet } from "@/design-system";
import type { AccountRow, TransactionRow } from "@/lib/db/schema";
import { useCurrencies } from "@/hooks/use-currencies";
import { useTrackedCurrencies } from "@/hooks/use-tracked-currencies";
import { useSuggestedFxRate } from "@/hooks/use-fx-rate";
import { formatRateTrimmed, invertRate, roundRateForDisplay, shouldInvertRateForDisplay } from "@/lib/fx/rate";
import { normalize } from "@/lib/search/rank";

export interface CurrencyPickerSheetProps {
  open: boolean;
  onClose: () => void;
  householdId: string | undefined;
  baseCurrency: string;
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
 * emitida en dólares — o, el que motivó ampliar esto, gastar en euros en un
 * viaje pagando con una cuenta que no está en euros. Antes había que
 * averiguar a mano cuántos dólares/euros eran — un dato que el usuario
 * muchas veces ni ve — o cambiar de cuenta. Ahora se tipea lo que dice el
 * ticket y la conversión la hace la app (`save-transaction.ts` la guarda en
 * `original_amount`/`original_currency`/`original_rate`, ver `CLAUDE.md` §
 * "son dos conversiones, no una").
 *
 * **EN USO** sale de `useTrackedCurrencies` (cuentas + movimientos +
 * overrides + preferencias de `/currencies`, más la moneda base) — antes
 * este sheet solo miraba cuentas y movimientos, así que agregar EUR en
 * Ajustes → Monedas sin tener una cuenta en euros no lo hacía aparecer acá.
 * Debajo, un buscador sobre el catálogo global (`useCurrencies`) para
 * cualquier otra moneda — filtra solo cuando hay texto, para no meter una
 * lista de ~30 monedas en el medio del flujo de 5 segundos.
 *
 * Sin banderas, chip con el código (`CLAUDE.md` § decisiones de imagen): la
 * bandera es del país, no de la moneda, y se rompe sola con el dólar o el
 * euro.
 */
export function CurrencyPickerSheet({ open, onClose, householdId, baseCurrency, accounts, transactions, accountCurrency, value, onChange }: CurrencyPickerSheetProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const { currencies: tracked } = useTrackedCurrencies(householdId, baseCurrency, accounts, transactions);
  const { data: catalog = [] } = useCurrencies();

  const trackedOptions = tracked.filter((code) => code !== accountCurrency);
  const needle = normalize(query);
  const catalogOptions = useMemo(() => {
    if (needle === "") return [];
    const trackedSet = new Set(trackedOptions);
    return catalog.filter((c) => c.code !== accountCurrency && !trackedSet.has(c.code) && (normalize(c.code).includes(needle) || normalize(c.name).includes(needle)));
  }, [catalog, needle, trackedOptions, accountCurrency]);

  const selected = value || accountCurrency || "";

  const pick = (code: string) => {
    onChange(code);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("capture.currencySheetTitle")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {trackedOptions.length > 0 ? (
            <>
              <p className="t-caption" style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
                {t("capture.currencySheetInUse")}
              </p>
              {trackedOptions.map((code) => (
                <TrackedCurrencyRow
                  key={code}
                  code={code}
                  quote={accountCurrency}
                  householdId={householdId}
                  selected={selected === code}
                  onClick={() => pick(code)}
                />
              ))}
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Input placeholder={t("capture.currencySheetSearchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={40} />
          {catalogOptions.map((c) => (
            <CurrencyRow key={c.code} code={c.code} hint={c.name} selected={selected === c.code} onClick={() => pick(c.code)} />
          ))}
          {needle !== "" && catalogOptions.length === 0 ? (
            <p className="t-body" style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
              {t("capture.category.noResults")}
            </p>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

/** Fila trackeada — muestra la cotización sugerida contra la moneda de la cuenta cuando la hay, o que está sin resolver cuando no. */
function TrackedCurrencyRow({
  code,
  quote,
  householdId,
  selected,
  onClick,
}: {
  code: string;
  quote: string | undefined;
  householdId: string | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations();
  const rate = useSuggestedFxRate(householdId, code, quote);
  // Ancla en la moneda que vale más, no siempre en `code` — "1 ARS =
  // 0,000643 USD" es ilegible; "1 USD = 1547,70 ARS" se lee al toque.
  // `shouldInvertRateForDisplay` (`lib/fx/rate.ts`) decide con el valor
  // real del rate, así que BTC y EUR (que valen más que USD) se muestran
  // sin invertir — solo se ancla en `quote` cuando `code` vale menos.
  const hint =
    !quote || code === quote
      ? undefined
      : rate.data?.rate != null
        ? shouldInvertRateForDisplay(rate.data.rate)
          ? // `roundRateForDisplay` antes de invertir: el recíproco de un
            // rate de 12 decimales rara vez cae en un número redondo
            // (1/0,000643086817 ≈ 1554,9999923575), y sin este paso ese
            // ruido de la división terminaba impreso tal cual.
            `1 ${quote} = ${formatRateTrimmed(roundRateForDisplay(invertRate(rate.data.rate)))} ${code}`
          : `1 ${code} = ${formatRateTrimmed(rate.data.rate)} ${quote}`
        : t("capture.captureRatePending");
  return <CurrencyRow code={code} hint={hint} selected={selected} onClick={onClick} />;
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
