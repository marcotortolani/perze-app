"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, Keypad, Sheet } from "@/design-system";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import type { NumberLocale } from "@/lib/money/parse";
import { formatAmount } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { cardStatementsRepo, type CardStatement } from "@/lib/repos/card-statements-repo";

export interface ConfirmStatementSheetProps {
  open: boolean;
  statement: CardStatement;
  numberLocale: NumberLocale;
  onClose: () => void;
  onConfirmed: () => void;
}

/**
 * "Llegó el resumen" (Tanda 4) — el único camino real para cerrar un
 * ciclo de tarjeta. Los tres campos vienen PRELLENADOS con la proyección
 * (`statement.closingDate`/`dueDate`/`statementBalance`, calculados por
 * `open_card_statements()` a partir de `statementDay`/`dueDay` del grupo/
 * cuenta) pero son editables — la regla nunca es la verdad, solo el punto
 * de partida. Confirmar corre `confirm_card_statement()`: pisa los tres
 * valores, marca el ciclo como confirmado, lo cierra de verdad, y abre el
 * próximo como una proyección nueva.
 */
export function ConfirmStatementSheet({ open, statement, numberLocale, onClose, onConfirmed }: ConfirmStatementSheetProps) {
  const t = useTranslations();
  const [closingDate, setClosingDate] = useState(statement.closingDate);
  const [dueDate, setDueDate] = useState(statement.dueDate);
  const [amountExpr, setAmountExpr] = useState(String(statement.statementBalance));
  const [saving, setSaving] = useState(false);

  const parsedAmount = (() => {
    try {
      return evaluateKeypadExpression(amountExpr || "0", statement.currencyCode, numberLocale);
    } catch {
      return null;
    }
  })();
  const canSave = !!closingDate && !!dueDate && parsedAmount !== null && parsedAmount.amount >= 0n;

  const handleConfirm = async () => {
    if (!canSave || !parsedAmount || saving) return;
    setSaving(true);
    try {
      await cardStatementsRepo.confirmStatement(statement.id, {
        closingDate,
        dueDate,
        statementBalance: parsedAmount.amount,
      });
      toast(t("cardCyclePage.statementConfirmed"));
      onConfirmed();
      onClose();
    } catch (error) {
      console.error("[card] no se pudo confirmar el resumen", error);
      toast(t("cardCyclePage.statementConfirmError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title={t("cardCyclePage.statementArrived")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0 }}>
          {t("cardCyclePage.statementArrivedExplainer")}
        </p>
        <Input label={t("cardCyclePage.closingDate")} type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
        <Input label={t("cardCyclePage.dueDateLabel")} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.statementTotal")}</span>
          <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--text-primary)" }}>
            {parsedAmount ? formatAmount(money(parsedAmount.amount, statement.currencyCode), { showSign: false }) : amountExpr || "0"}
          </div>
          <Keypad onKey={(k) => setAmountExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + (k === "," ? "," : k)))} onClear={() => setAmountExpr("")} />
        </div>
        <Button disabled={!canSave || saving} onClick={handleConfirm}>
          {t("cardCyclePage.confirmStatement")}
        </Button>
      </div>
    </Sheet>
  );
}
