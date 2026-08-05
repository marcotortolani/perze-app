"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, Input, Keypad, ListRow, Sheet, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useInvalidateGoals } from "@/hooks/use-goals";
import { useTransactions } from "@/hooks/use-transactions";
import { goalsRepo } from "@/lib/repos/goals-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { computeThreeMonthCushion } from "@/lib/analytics/goal-projection";
import { formatAmount, formatAmountCompact } from "@/lib/money/format";
import { money, toMajorUnitsUnsafe } from "@/lib/money/money";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

/** F7 — crear meta: nombre, monto objetivo, cuenta que la respalda. La sugerencia "colchón de 3 meses" (F7, estado vacío del diseño) prellena el monto con 3x el gasto diario promedio de los últimos 90 días. */
export default function NewGoalPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: transactions = [] } = useTransactions(household?.id);
  const invalidateGoals = useInvalidateGoals(household?.id);
  usePageHeader({ title: t("goalsPage.newGoal"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [name, setName] = useState("");
  const [expr, setExpr] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Con `cacheComponents: true` (Next 16), `router.back()` no desmonta esta
  // pantalla — la deja oculta (`Activity`, modo hidden) con su `useState`
  // intacto. Los efectos SÍ se limpian al ocultarse, así que la cleanup de
  // un efecto vacío es el único gancho confiable para "se abandonó este
  // formulario": ahí se resetea el borrador entero, para que la próxima
  // entrada a `/goals/new` arranque vacía en vez de heredar el nombre y el
  // monto de la meta anterior. Mismo patrón que `recurring/new/page.tsx`.
  useEffect(() => {
    return () => {
      setName("");
      setExpr("");
      setAccountId(null);
      setAccountSheetOpen(false);
      setSaving(false);
    };
  }, []);

  if (!household || !userId) return null;

  const account = accounts.find((a) => a.id === accountId);
  const canSave = name.trim() !== "" && expr.trim() !== "";
  const cushion = computeThreeMonthCushion(transactions, new Date());
  const cushionMoney = money(cushion, household.baseCurrency);
  const numberLocale = numberLocaleForUiLocale(locale);
  // Monto YA EVALUADO y formateado, no la expresión cruda tal como se
  // tipea — mostrar `"10000+5000"` literal (sin separador de miles, sin
  // evaluar) es lo que hacía confuso este monto: el usuario nunca veía el
  // número que se iba a guardar hasta después de guardar. `evaluateKeypadExpression`
  // tolera una expresión a medio tipear (un operador colgando al final no
  // rompe, ver `lib/money/keypad.ts`), así que es seguro llamarla en cada
  // tecla.
  const heroAmount = formatAmount(evaluateKeypadExpression(expr || "0", household.baseCurrency, numberLocale), { showSign: false, locale: numberLocale });

  const useCushion = () => setExpr(String(toMajorUnitsUnsafe(cushionMoney)).replace(".", decimalSeparator));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const target = evaluateKeypadExpression(expr, household.baseCurrency, numberLocaleForUiLocale(locale));
      await goalsRepo.create({
        householdId: household.id,
        name: name.trim(),
        icon: null,
        color: null,
        targetAmount: target.amount,
        currencyCode: household.baseCurrency,
        targetDate: null,
        accountId,
        createdBy: userId,
      });
      invalidateGoals();
      toast(t("goalsPage.created"));
      // `back()`, no `replace`/`push` — la lista ya está en el historial
      // justo debajo. `replace("/goals")` duplicaba esa misma entrada.
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* `lg`+: el formulario queda a la izquierda tal cual estaba — la
          columna del grid ya da un ancho parecido a `--content-max-width` —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
          <Input label={t("goalsPage.name")} placeholder={t("goalsPage.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />

          {expr.trim() === "" && cushion > 0n ? (
            <ListRow
              icon="target"
              label={t("goalsPage.useCushion", { amount: formatAmountCompact(cushionMoney, { showSign: false }) })}
              variant="action"
              onClick={useCushion}
            />
          ) : null}

          <button type="button" onClick={() => setAccountSheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("goalsPage.account")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
          </button>

          <div style={{ textAlign: "center" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("goalsPage.targetAmount")}</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 32 }}>{heroAmount}</div>
          </div>

          <div style={{ marginTop: "auto" }}>
            <Keypad onKey={(k) => setExpr((s) => (k === "clear" ? "" : k === "backspace" ? s.slice(0, -1) : s + (k === "," ? decimalSeparator : k)))} onClear={() => setExpr("")} />
            <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: 16 }}>
              {t("common.save")}
            </Button>
          </div>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={accountSheetOpen} title={t("goalsPage.chooseAccount")} onClose={() => setAccountSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountId(a.id); setAccountSheetOpen(false); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
