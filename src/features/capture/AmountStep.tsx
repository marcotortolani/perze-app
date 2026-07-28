"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Amount, Chip, Icon, Keypad, SegmentedControl } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money } from "@/lib/money/money";
import type { AccountRow, CategoryRow } from "@/lib/db/schema";
import type { CaptureDraft, CaptureKind } from "@/stores/capture-draft-store";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useFrequentCategories } from "./use-frequent-categories";

export interface AmountStepProps {
  draft: CaptureDraft;
  accounts: AccountRow[];
  categories: CategoryRow[];
  account: AccountRow | undefined;
  counterAccount: AccountRow | undefined;
  onKindChange: (kind: CaptureKind) => void;
  onAmountKey: (key: string) => void;
  onOpenAccountPicker: () => void;
  onOpenCounterAccountPicker: () => void;
  onInvertTransfer: () => void;
  onQuickCategory: (category: CategoryRow) => void;
  onOpenDetails: () => void;
  onVoice: () => void;
  onPhoto: () => void;
}

/** C1 — el paso que abre el FAB. El primer frame es interactivo: se puede escribir en el keypad al toque. */
export function AmountStep({
  draft,
  accounts,
  categories,
  account,
  counterAccount,
  onKindChange,
  onAmountKey,
  onOpenAccountPicker,
  onOpenCounterAccountPicker,
  onInvertTransfer,
  onQuickCategory,
  onOpenDetails,
  onVoice,
  onPhoto,
}: AmountStepProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const KIND_OPTIONS = [
    { id: "expense", label: t("capture.kind.expense") },
    { id: "income", label: t("capture.kind.income") },
    { id: "transfer", label: t("capture.kind.transfer") },
  ];
  const currency = draft.currency || account?.currencyCode || "UYU";
  const hero = useMemo(() => {
    try {
      return evaluateKeypadExpression(draft.amountExpression || "0", currency);
    } catch {
      return money(0n, currency);
    }
  }, [draft.amountExpression, currency]);

  const frequent = useFrequentCategories(categories, draft.kind === "income" ? "income" : "expense", 4);
  const isTransfer = draft.kind === "transfer";
  const hasAccounts = accounts.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
      <SegmentedControl options={KIND_OPTIONS} value={draft.kind} onChange={(id) => onKindChange(id as CaptureKind)} />

      <div style={{ textAlign: "center" }}>
        {/* La cifra en captura es una entrada, no todavía un movimiento con
            polaridad: neutra y sin signo mientras se tipea (el +/− aqua es
            para la lista, no para el keypad). */}
        <Amount value={hero} size="hero-xl" showSign={false} polarity="neutral" mutedDecimals tabular />
      </div>

      {isTransfer ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onOpenAccountPicker}
            style={{ flex: 1, textAlign: "left", background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, cursor: "pointer" }}
          >
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
              {t("capture.from")}
            </div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("capture.chooseAccount")}</div>
          </button>
          <button type="button" onClick={onInvertTransfer} aria-label={t("capture.invert")} style={{ background: "none", border: 0, cursor: "pointer", padding: 8 }}>
            <Icon name="refresh" size={20} color="var(--text-secondary)" />
          </button>
          <button
            type="button"
            onClick={onOpenCounterAccountPicker}
            style={{ flex: 1, textAlign: "left", background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, cursor: "pointer" }}
          >
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
              {t("capture.to")}
            </div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{counterAccount ? counterAccount.name : t("capture.chooseAccount")}</div>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenAccountPicker}
          style={{ background: "none", border: 0, cursor: hasAccounts ? "pointer" : "default", padding: 0, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}
        >
          {account ? `${account.name} · ${currency}` : t("capture.chooseAccount")}
        </button>
      )}

      {!isTransfer && frequent.length > 0 ? (
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {frequent.map((c) => (
            <Chip key={c.id} icon={c.icon as IconName} onClick={() => onQuickCategory(c)}>
              {categoryLabel(c)}
            </Chip>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
        <button type="button" onClick={onVoice} aria-label={t("capture.voiceLabel")} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Icon name="mic" size={20} color="var(--text-secondary)" />
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("capture.voice")}
          </span>
        </button>
        <button type="button" onClick={onPhoto} aria-label={t("capture.photoLabel")} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Icon name="camera" size={20} color="var(--text-secondary)" />
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("capture.photo")}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={t("capture.details")}
          style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
        >
          <Icon name="filter" size={20} color="var(--text-secondary)" />
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("capture.details")}
          </span>
        </button>
      </div>

      <div style={{ marginTop: "auto" }}>
        <Keypad onKey={onAmountKey} onClear={() => onAmountKey("clear")} />
      </div>
    </div>
  );
}
