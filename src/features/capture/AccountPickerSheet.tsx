"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccountRow, Sheet } from "@/design-system";
import type { AccountRow as AccountRowData, TransactionRow } from "@/lib/db/schema";
import { money } from "@/lib/money/money";
import { ACCOUNT_KIND_ICON } from "@/lib/reference/account-kind-labels";
import { accountColorVar } from "@/lib/reference/account-colors";
import { usePinUnlocked } from "@/components/pin-gate";
import { rankRecentAccountsByUsage } from "@/lib/analytics/account-usage";

export interface AccountPickerSheetProps {
  open: boolean;
  title: string;
  accounts: AccountRowData[];
  /** Para la sección "Más usadas" y para armar los grupos por moneda con el mismo criterio que `/accounts`. */
  transactions: TransactionRow[] | undefined;
  baseCurrency: string;
  onSelect: (account: AccountRowData) => void;
  onClose: () => void;
}

const MIN_ACCOUNTS_FOR_FREQUENT_SECTION = 5;
const FREQUENT_LIMIT = 3;

/**
 * C22 — este picker se abre desde `/add` (captura pre-auth por diseño, ver
 * `PinGate`), así que el bloqueo por PIN no lo cubre. Sin esto, un
 * long-press en el ícono del shortcut evadía el bloqueo mostrando nombre y
 * saldo de cada cuenta. `privacy` blurea el monto (no oculta el resto del
 * picker: elegir cuenta para guardar sigue siendo pre-auth, "escribir no
 * revela nada" — el saldo sí revela).
 *
 * Ordenado en dos secciones — antes era la lista cruda de `accounts.map`,
 * sin ningún criterio: **Más usadas** (top 3 por uso real, mismo cálculo
 * que las categorías frecuentes) cuando hay suficientes cuentas para que
 * valga la pena, y el resto agrupado por moneda (base primero, después
 * alfabético) y por `sortOrder` dentro de cada grupo — mismo criterio que
 * `/accounts` (`AccountsListContent.tsx`). Con pocas cuentas la sección de
 * frecuentes es puro ruido y duplica lo de abajo, así que solo aparece con
 * `>= 5` cuentas activas y al menos 2 con uso real.
 */
export function AccountPickerSheet({ open, title, accounts, transactions, baseCurrency, onSelect, onClose }: AccountPickerSheetProps) {
  const t = useTranslations();
  const pinUnlocked = usePinUnlocked();
  // Capturado una vez al abrir, no en cada render — mismo criterio que
  // `CaptureFlow` para `useFrequentCategories` (`rankRecentAccountsByUsage`
  // compara por `now.getTime()`).
  const [now] = useState(() => new Date());

  const active = accounts.filter((a) => a.archivedAt === null);
  const usageCount = new Set((transactions ?? []).map((tx) => tx.accountId).filter((id) => active.some((a) => a.id === id))).size;
  const showFrequent = active.length >= MIN_ACCOUNTS_FOR_FREQUENT_SECTION && usageCount >= 2;
  const frequent = showFrequent ? rankRecentAccountsByUsage(active, transactions ?? [], { limit: FREQUENT_LIMIT, now }) : [];
  const frequentIds = new Set(frequent.map((a) => a.id));

  const rest = active.filter((a) => !frequentIds.has(a.id));
  const byCurrency = new Map<string, AccountRowData[]>();
  for (const a of rest) {
    const list = byCurrency.get(a.currencyCode) ?? [];
    list.push(a);
    byCurrency.set(a.currencyCode, list);
  }
  const groups = [...byCurrency.entries()]
    .sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)))
    .map(([currency, group]) => [currency, [...group].sort((x, y) => x.sortOrder - y.sortOrder)] as const);

  const renderRow = (a: AccountRowData) => (
    <AccountRow
      key={a.id}
      name={a.name}
      meta={a.currencyCode}
      balance={money(a.currentBalance, a.currencyCode)}
      icon={ACCOUNT_KIND_ICON[a.kind]}
      iconBackground={accountColorVar(a.color)}
      privacy={!pinUnlocked}
      onClick={() => {
        onSelect(a);
        onClose();
      }}
    />
  );

  return (
    // 8 filas de 56px sin scroll (`ListRow` es de altura fija) — `Overlay`
    // sigue capando a `80dvh`, así que en un teléfono muy bajo (iPhone SE)
    // igual aparece scroll con encabezados de sección; es el límite físico
    // de pantalla, no algo que se pueda subir más sin tapar toda la pantalla.
    <Sheet open={open} title={title} onClose={onClose} height={560}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {frequent.length > 0 ? (
          <>
            <SectionHeader label={t("capture.accountPicker.frequent")} />
            {frequent.map(renderRow)}
          </>
        ) : null}
        {groups.map(([currency, group]) => (
          <div key={currency}>
            <SectionHeader label={currency} />
            {group.map(renderRow)}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="t-caption" style={{ margin: "12px 4px 4px", color: "var(--text-muted)" }}>
      {label}
    </p>
  );
}
