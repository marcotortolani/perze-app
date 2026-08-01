"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Icon } from "@/design-system";
import { MorphButton } from "@/components/motion";
import { ScreenShell } from "@/components/screen-shell";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories, useInvalidateCategories } from "@/hooks/use-categories";
import { useInvalidateAfterTransactionWrite, useTransactions } from "@/hooks/use-transactions";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import type { AccountRow } from "@/lib/db/schema";
import { useCaptureDraftStore } from "@/stores/capture-draft-store";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { AccountPickerSheet } from "./AccountPickerSheet";
import { AmountStep } from "./AmountStep";
import { CategoryStep } from "./CategoryStep";
import { DetailsSheet } from "./DetailsSheet";
import { VoiceCaptureSheet } from "./VoiceCaptureSheet";
import { saveDraftAsTransaction } from "./save-transaction";
import { buildNewCategoryInput } from "./create-category";
import { useFrequentCategories } from "./use-frequent-categories";

type Step = "amount" | "category";
type SheetKind = "none" | "account" | "counterAccount" | "details" | "voice";

export interface CaptureFlowProps {
  onClose?: () => void;
}

/**
 * Bloque C completo: C1 (monto), C2 (categoría, fallback), C3 (detalles),
 * C6 (transferencia), C7 (guardado + deshacer), C8 (ráfaga), C9 (voz).
 * C4 (moneda distinta a la de la cuenta) y C10 (foto) quedan fuera de
 * este paso — ver `save-transaction.ts` y el botón de cámara.
 *
 * Invariante duro: guardar no puede fallar. El guardado es local
 * (Dexie); la red es un detalle de otra capa.
 */
export function CaptureFlow({ onClose }: CaptureFlowProps) {
  const t = useTranslations();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const invalidateCategories = useInvalidateCategories(household?.id);
  // Capturado una vez al montar, no en cada render: `useFrequentCategories`
  // compara por `now.getTime()`, así que un `Date` estable evita
  // recalcular el ranking en cada tecla del keypad.
  const [now] = useState(() => new Date());

  const draft = useCaptureDraftStore((s) => s.draft);
  const setField = useCaptureDraftStore((s) => s.setField);
  const setKind = useCaptureDraftStore((s) => s.setKind);
  const appendToAmount = useCaptureDraftStore((s) => s.appendToAmount);
  const backspaceAmount = useCaptureDraftStore((s) => s.backspaceAmount);
  const clearAmount = useCaptureDraftStore((s) => s.clearAmount);
  const resetForBurst = useCaptureDraftStore((s) => s.resetForBurst);
  const reset = useCaptureDraftStore((s) => s.reset);

  const [step, setStep] = useState<Step>("amount");
  const [sheet, setSheet] = useState<SheetKind>("none");

  // Cuenta por defecto — todavía sin heurística de "más usada en esta
  // categoría". Se resuelve derivado, nunca escribiendo al store durante
  // el render: si el usuario no eligió ninguna, `doSave` cae a esta misma
  // cuenta por default sin necesidad de persistirla antes de guardar.
  const account = accounts.find((a) => a.id === draft.accountId) ?? accounts[0];
  const counterAccount = accounts.find((a) => a.id === draft.counterAccountId);

  const categoryKind = draft.kind === "income" ? "income" : "expense";
  const sameKindCategories = categories.filter((c) => c.kind === categoryKind);
  const frequentCategories = useFrequentCategories(categories, transactions, categoryKind, now, 5);

  const handleCreateCategory = async (name: string) => {
    if (!household) throw new Error("no household");
    const created = await categoriesRepo.create(
      buildNewCategoryInput({ householdId: household.id, name, kind: categoryKind, createdBy: userId, existing: sameKindCategories })
    );
    invalidateCategories();
    return created;
  };

  const handleAmountKey = (key: string) => {
    if (key === "clear") clearAmount();
    else if (key === "backspace") backspaceAmount();
    else appendToAmount(key === "," ? "," : key);
  };

  const canSave = () => {
    if (!household || !account) return false;
    if (draft.amountExpression.trim() === "") return false;
    if (draft.kind === "transfer") return !!counterAccount;
    return !!draft.categoryId;
  };

  const doSave = async () => {
    if (!household || !account) return;
    // Se lee `getState()` en vez del `draft` reactivo de este closure: si
    // esta función corre justo después de un `setField` (p. ej. el chip de
    // categoría frecuente), el closure todavía tendría el valor viejo.
    const latestDraft = useCaptureDraftStore.getState().draft;
    const latestAccount = accounts.find((a) => a.id === latestDraft.accountId) ?? account;
    const latestCounterAccount = accounts.find((a) => a.id === latestDraft.counterAccountId);

    const tx = await saveDraftAsTransaction({
      draft: latestDraft,
      household,
      userId,
      account: latestAccount,
      counterAccount: latestCounterAccount,
    });
    invalidateTransactions();

    // El toast vive en el `<Toaster>` global (providers.tsx), no en este
    // componente: tiene que sobrevivir a que `CaptureFlow` se desmonte al
    // volver a la lista (C7 — "la card vuela, aparece el toast con Deshacer").
    // C11a: el copy distingue needs_fx (rate por resolver) de estar
    // offline al guardar (el mismo movimiento, otra razón) — son dos
    // problemas distintos y el usuario necesita saber cuál es.
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const savedMessage = tx.fxSource === "pending" ? t("capture.savedPendingFx") : offline ? t("capture.savedOffline") : t("capture.saved");
    toast(savedMessage, {
      duration: 5000,
      action: {
        label: t("capture.undo"),
        onClick: async () => {
          await transactionsRepo.softDelete(tx.id);
          invalidateTransactions();
        },
      },
    });
  };

  const handleAfterSaveComplete = () => {
    if (draft.burstMode) {
      resetForBurst();
      setStep("amount");
    } else {
      reset();
      onClose?.();
    }
  };

  const handleCancel = () => {
    if (step === "category") {
      setStep("amount");
      return;
    }
    reset();
    onClose?.();
  };

  if (!household) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <p className="t-body" style={{ color: "var(--text-secondary)" }}>
          {t("common.loading")}
        </p>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={handleCancel}
          aria-label={step === "category" ? t("capture.back") : t("capture.close")}
          style={{ background: "none", border: 0, cursor: "pointer", padding: 8, margin: -8 }}
        >
          <Icon name={step === "category" ? "chevron-left" : "close"} size={22} color="var(--text-secondary)" />
        </button>
        {draft.burstMode ? (
          <span className="t-label" style={{ color: "var(--text-secondary)" }}>
            {t("capture.burstCount", { count: draft.burstCount })}
          </span>
        ) : null}
      </div>

      {step === "amount" ? (
        <AmountStep
          draft={draft}
          accounts={accounts}
          frequent={frequentCategories}
          account={account}
          counterAccount={counterAccount}
          onKindChange={setKind}
          onAmountKey={handleAmountKey}
          onAmountChange={(expression) => setField("amountExpression", expression)}
          onOpenAccountPicker={() => setSheet("account")}
          onOpenCounterAccountPicker={() => setSheet("counterAccount")}
          onInvertTransfer={() => {
            const from = draft.accountId;
            setField("accountId", draft.counterAccountId);
            setField("counterAccountId", from);
          }}
          onQuickCategory={async (category) => {
            setField("categoryId", category.id);
            await doSave();
            handleAfterSaveComplete();
          }}
          onOpenCategoryPicker={() => setStep("category")}
          onOpenDetails={() => setSheet("details")}
          onVoice={() => setSheet("voice")}
          onPhoto={() => toast(t("capture.photoComingSoon"))}
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
          onComplete={handleAfterSaveComplete}
        >
          {step === "amount" && draft.kind !== "transfer" && !draft.categoryId ? t("capture.next") : t("capture.save")}
        </MorphButton>
      </div>

      <AccountPickerSheet open={sheet === "account"} title={t("capture.accountPicker.sourceTitle")} accounts={accounts} onSelect={(a) => setField("accountId", a.id)} onClose={() => setSheet("none")} />
      <AccountPickerSheet
        open={sheet === "counterAccount"}
        title={t("capture.accountPicker.destinationTitle")}
        accounts={accounts.filter((a: AccountRow) => a.id !== draft.accountId)}
        onSelect={(a) => setField("counterAccountId", a.id)}
        onClose={() => setSheet("none")}
      />
      <DetailsSheet open={sheet === "details"} onClose={() => setSheet("none")} draft={draft} accounts={accounts} onSetField={setField} />
      <VoiceCaptureSheet
        key={sheet === "voice" ? "voice-open" : "voice-closed"}
        open={sheet === "voice"}
        onClose={() => setSheet("none")}
        onApply={({ amountExpression, payeeName }) => {
          if (amountExpression) setField("amountExpression", amountExpression);
          if (payeeName) setField("payeeName", payeeName);
        }}
      />
    </ScreenShell>
  );
}
