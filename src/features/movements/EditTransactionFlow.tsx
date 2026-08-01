"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Icon } from "@/design-system";
import { MorphButton } from "@/components/motion";
import { ScreenShell } from "@/components/screen-shell";
import { AccountPickerSheet } from "@/features/capture/AccountPickerSheet";
import { AmountStep } from "@/features/capture/AmountStep";
import { CategoryStep } from "@/features/capture/CategoryStep";
import { DetailsSheet } from "@/features/capture/DetailsSheet";
import { useFrequentCategories } from "@/features/capture/use-frequent-categories";
import { buildNewCategoryInput } from "@/features/capture/create-category";
import { useInvalidateTransactions, useTransactions } from "@/hooks/use-transactions";
import { useInvalidateCategories } from "@/hooks/use-categories";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { formatAmount } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { useCaptureDraftStore } from "@/stores/capture-draft-store";
import type { AccountRow, CategoryRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { updateTransactionFromDraft } from "./update-transaction";

export interface EditTransactionFlowProps {
  transaction: TransactionRow;
  household: HouseholdRow;
  accounts: AccountRow[];
  categories: CategoryRow[];
  onClose: () => void;
}

const STALE_DAYS = 3;

/** D4 — mismo flujo que la carga, con los valores existentes cargados. Reusa los pasos del Bloque C. */
export function EditTransactionFlow({ transaction, household, accounts, categories, onClose }: EditTransactionFlowProps) {
  const t = useTranslations();
  const draft = useCaptureDraftStore((s) => s.draft);
  const setField = useCaptureDraftStore((s) => s.setField);
  const setKind = useCaptureDraftStore((s) => s.setKind);
  const appendToAmount = useCaptureDraftStore((s) => s.appendToAmount);
  const backspaceAmount = useCaptureDraftStore((s) => s.backspaceAmount);
  const clearAmount = useCaptureDraftStore((s) => s.clearAmount);
  const reset = useCaptureDraftStore((s) => s.reset);
  const invalidateTransactions = useInvalidateTransactions(household.id);
  const invalidateCategories = useInvalidateCategories(household.id);
  const userId = useCurrentUserId();
  const { data: transactions } = useTransactions(household.id);

  const [step, setStep] = useState<"amount" | "category">("amount");
  const [sheet, setSheet] = useState<"none" | "account" | "counterAccount" | "details">("none");
  // Capturado una sola vez al montar (lazy init, no en el cuerpo del render)
  // — evita llamar a `Date.now()` en cada render solo para comparar antigüedad.
  const [openedAtMs] = useState(() => Date.now());
  const [now] = useState(() => new Date());
  const isStale = transaction.currencyCode !== household.baseCurrency && openedAtMs - new Date(transaction.occurredAt).getTime() > STALE_DAYS * 86_400_000;

  const categoryKind = draft.kind === "income" ? "income" : "expense";
  const sameKindCategories = categories.filter((c) => c.kind === categoryKind);
  const frequentCategories = useFrequentCategories(categories, transactions, categoryKind, now, 5);

  const handleCreateCategory = async (name: string) => {
    const created = await categoriesRepo.create(
      buildNewCategoryInput({ householdId: household.id, name, kind: categoryKind, createdBy: userId, existing: sameKindCategories })
    );
    invalidateCategories();
    return created;
  };

  useEffect(() => {
    reset();
    setField("kind", transaction.kind === "adjustment" ? "expense" : transaction.kind);
    setField("amountExpression", formatAmount(money(transaction.amount, transaction.currencyCode), { showSign: false, showSymbol: false }));
    setField("currency", transaction.currencyCode);
    setField("accountId", transaction.accountId);
    setField("counterAccountId", transaction.counterAccountId);
    setField("categoryId", transaction.categoryId);
    setField("occurredAt", transaction.occurredAt);
    setField("note", transaction.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id]);

  const account = accounts.find((a) => a.id === draft.accountId);
  const counterAccount = accounts.find((a) => a.id === draft.counterAccountId);

  const canSave = () => {
    if (!account || draft.amountExpression.trim() === "") return false;
    if (draft.kind === "transfer") return !!counterAccount;
    return !!draft.categoryId;
  };

  const doSave = async () => {
    if (!account) return;
    const latestDraft = useCaptureDraftStore.getState().draft;
    const latestAccount = accounts.find((a) => a.id === latestDraft.accountId) ?? account;
    const latestCounterAccount = accounts.find((a) => a.id === latestDraft.counterAccountId);

    await updateTransactionFromDraft({ transactionId: transaction.id, draft: latestDraft, household, account: latestAccount, counterAccount: latestCounterAccount });
    invalidateTransactions();
    toast(t("movements.editFlow.updated"));
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => (step === "category" ? setStep("amount") : onClose())}
          aria-label={step === "category" ? t("capture.back") : t("capture.close")}
          style={{ background: "none", border: 0, cursor: "pointer", padding: 8, margin: -8 }}
        >
          <Icon name={step === "category" ? "chevron-left" : "close"} size={22} color="var(--text-secondary)" />
        </button>
        <span className="t-label" style={{ color: "var(--text-secondary)" }}>
          {t("movements.editFlow.title")}
        </span>
      </div>

      {isStale ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderRadius: "var(--radius-card)", background: "color-mix(in srgb, var(--warning) 12%, transparent)" }}>
          <Icon name="alert" size={16} color="var(--warning)" />
          <span style={{ fontSize: 13, color: "var(--warning)" }}>{t("movements.editFlow.stale")}</span>
        </div>
      ) : null}

      {step === "amount" ? (
        <AmountStep
          draft={draft}
          accounts={accounts}
          frequent={frequentCategories}
          account={account}
          counterAccount={counterAccount}
          onKindChange={setKind}
          onAmountKey={(key) => (key === "clear" ? clearAmount() : key === "backspace" ? backspaceAmount() : appendToAmount(key === "," ? "," : key))}
          onAmountChange={(expression) => setField("amountExpression", expression)}
          onOpenAccountPicker={() => setSheet("account")}
          onOpenCounterAccountPicker={() => setSheet("counterAccount")}
          onInvertTransfer={() => {
            const from = draft.accountId;
            setField("accountId", draft.counterAccountId);
            setField("counterAccountId", from);
          }}
          onQuickCategory={(category) => setField("categoryId", category.id)}
          onOpenCategoryPicker={() => setStep("category")}
          onOpenDetails={() => setSheet("details")}
          onVoice={() => toast(t("movements.editFlow.voiceUnavailable"))}
          onPhoto={() => toast(t("movements.editFlow.photoComingSoon"))}
        />
      ) : (
        <CategoryStep
          categories={sameKindCategories}
          frequent={frequentCategories}
          selectedId={draft.categoryId}
          onSelect={(c) => setField("categoryId", c.id)}
          onCreate={handleCreateCategory}
        />
      )}

      <div style={{ marginTop: "auto" }}>
        <MorphButton
          disabled={!canSave()}
          onConfirm={async () => {
            if (draft.kind !== "transfer" && step === "amount" && !draft.categoryId) {
              setStep("category");
              return;
            }
            await doSave();
          }}
          onComplete={onClose}
        >
          {step === "amount" && draft.kind !== "transfer" && !draft.categoryId ? t("movements.editFlow.next") : t("movements.editFlow.saveChanges")}
        </MorphButton>
      </div>

      <AccountPickerSheet open={sheet === "account"} title={t("capture.accountPicker.sourceTitle")} accounts={accounts} onSelect={(a) => setField("accountId", a.id)} onClose={() => setSheet("none")} />
      <AccountPickerSheet
        open={sheet === "counterAccount"}
        title={t("capture.accountPicker.destinationTitle")}
        accounts={accounts.filter((a) => a.id !== draft.accountId)}
        onSelect={(a) => setField("counterAccountId", a.id)}
        onClose={() => setSheet("none")}
      />
      <DetailsSheet open={sheet === "details"} onClose={() => setSheet("none")} draft={draft} accounts={accounts} onSetField={setField} />
    </ScreenShell>
  );
}
