"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Icon, IconButton } from "@/design-system";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { MorphButton } from "@/components/motion";
import { ScreenShell } from "@/components/screen-shell";
import { AccountPickerSheet } from "@/features/capture/AccountPickerSheet";
import { CurrencyPickerSheet } from "@/features/capture/CurrencyPickerSheet";
import { AmountStep, amountToExpression } from "@/features/capture/AmountStep";
import { CategoryStep } from "@/features/capture/CategoryStep";
import { DetailsSheet } from "@/features/capture/DetailsSheet";
import { useFrequentCategories } from "@/features/capture/use-frequent-categories";
import { dedupeCategoriesByIdentity } from "@/lib/analytics/category-usage";
import { buildNewCategoryInput } from "@/features/capture/create-category";
import { useInvalidateAfterTransactionWrite, useTransactions } from "@/hooks/use-transactions";
import { useInvalidateCategories } from "@/hooks/use-categories";
import { useInvalidateTags, useTags } from "@/hooks/use-tags";
import { useInvalidateTransactionTags, useTagIdsForTransaction } from "@/hooks/use-transaction-tags";
import { usePayees } from "@/hooks/use-payees";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { tagsRepo } from "@/lib/repos/tags-repo";
import { CaptureDraftProvider, useCaptureDraftStore, useCaptureDraftStoreApi } from "@/stores/capture-draft-store";
import type { AccountRow, CategoryRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { useFrequentTags } from "@/features/capture/use-frequent-tags";
import { useFrequentPayees } from "@/features/capture/use-frequent-payees";
import { updateTransactionFromDraft } from "./update-transaction";
import { hasNonZeroAmount } from "@/features/capture/save-transaction";

export interface EditTransactionFlowProps {
  transaction: TransactionRow;
  household: HouseholdRow;
  accounts: AccountRow[];
  categories: CategoryRow[];
  onClose: () => void;
}

const STALE_DAYS = 3;

/**
 * D4 — mismo flujo que la carga, con los valores existentes cargados.
 * Reusa los pasos del Bloque C.
 *
 * Store propio (`CaptureDraftProvider`), no el singleton que existía
 * antes: editar un movimiento escribía sobre el MISMO store que usa
 * `/add`, y como nunca se limpiaba al salir de la edición, el próximo "+"
 * heredaba los campos del movimiento recién editado. Con un store por
 * instancia, cerrar esta pantalla se lleva el draft con ella — no hay
 * nada que limpiar a mano.
 */
export function EditTransactionFlow(props: EditTransactionFlowProps) {
  return (
    <CaptureDraftProvider>
      <EditTransactionFlowInner {...props} />
    </CaptureDraftProvider>
  );
}

function EditTransactionFlowInner({ transaction, household, accounts, categories, onClose }: EditTransactionFlowProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const draft = useCaptureDraftStore((s) => s.draft);
  const setField = useCaptureDraftStore((s) => s.setField);
  const setKind = useCaptureDraftStore((s) => s.setKind);
  const appendToAmount = useCaptureDraftStore((s) => s.appendToAmount);
  const backspaceAmount = useCaptureDraftStore((s) => s.backspaceAmount);
  const clearAmount = useCaptureDraftStore((s) => s.clearAmount);
  const draftStoreApi = useCaptureDraftStoreApi();
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household.id);
  const invalidateCategories = useInvalidateCategories(household.id);
  const invalidateTags = useInvalidateTags(household.id);
  const invalidateTransactionTags = useInvalidateTransactionTags();
  const userId = useEffectiveUserId();
  const { data: transactions } = useTransactions(household.id);
  const { data: tags = [] } = useTags(household.id);
  const { data: payees = [] } = usePayees(household.id);
  const { data: existingTagIds } = useTagIdsForTransaction(transaction.id);
  const frequentTags = useFrequentTags(tags, (transactions ?? []).map((tx) => tx.id));
  const frequentPayees = useFrequentPayees(payees, transactions);

  const [step, setStep] = useState<"amount" | "category">("amount");
  const [sheet, setSheet] = useState<"none" | "account" | "counterAccount" | "currency" | "details">("none");
  // Capturado una sola vez al montar (lazy init, no en el cuerpo del render)
  // — evita llamar a `Date.now()` en cada render solo para comparar antigüedad.
  const [openedAtMs] = useState(() => Date.now());
  const [now] = useState(() => new Date());
  const isStale = transaction.currencyCode !== household.baseCurrency && openedAtMs - new Date(transaction.occurredAt).getTime() > STALE_DAYS * 86_400_000;

  const categoryKind = draft.kind === "income" ? "income" : "expense";
  const sameKindCategories = dedupeCategoriesByIdentity(categories.filter((c) => c.kind === categoryKind), transactions ?? []);
  const frequentCategories = useFrequentCategories(categories, transactions, categoryKind, now, 5);

  const handleCreateCategory = async (name: string) => {
    // B3 — nunca escribir con un uid que no sea real.
    if (!userId) throw new Error("sin sesión");
    const created = await categoriesRepo.create(
      buildNewCategoryInput({ householdId: household.id, name, kind: categoryKind, createdBy: userId, existing: sameKindCategories })
    );
    invalidateCategories();
    return created;
  };

  const handleCreateTag = async (name: string) => {
    const created = await tagsRepo.create(household.id, name);
    invalidateTags();
    return created;
  };

  useEffect(() => {
    // No hace falta un `reset()` acá: este store nace vacío con este
    // componente (`CaptureDraftProvider` en `EditTransactionFlow`), no es
    // el singleton compartido que exigía limpiarlo a mano antes de llenarlo.
    //
    // `investing` (settlement de un trade) no es un `CaptureKind` editable a
    // mano — igual que `adjustment`, cae a "expense" en el picker. Editar el
    // MONTO de una fila `investing` desde acá la desincroniza de su trade;
    // bloquear ese caso puntual queda pendiente (`TransactionDetailContent`
    // debería no ofrecer "editar" cuando `tradeId !== null`).
    setField("kind", transaction.kind === "adjustment" || transaction.kind === "investing" ? "expense" : transaction.kind);
    // `amountToExpression`, no `formatAmount`: el buffer del teclado tiene
    // que ser la expresión CRUDA que se tipearía a mano (sin separador de
    // miles, sin ceros de relleno) — `formatAmount` es para MOSTRAR, no
    // para editar. Con el string de presentación ("25.000,00"), borrar un
    // carácter a la vez no tocaba ningún dígito real hasta el cuarto
    // toque (los primeros tres se comían el padding de la fracción y el
    // separador de miles). Mismo patrón que ya usan `PayCardSheet.tsx` y
    // `recurring/[id]/edit/page.tsx`.
    // Un movimiento cargado en otra moneda (4.200 UYU pagados con la
    // tarjeta en USD) se reabre como se cargó: el monto del ticket y su
    // moneda, no el equivalente ya convertido. Antes esto ponía siempre
    // `transaction.currencyCode` —la moneda de la CUENTA— así que abrir y
    // guardar sin tocar nada reinterpretaba los 101,20 USD como si el
    // usuario los hubiera tipeado, y `original_*` se perdía en silencio.
    const capturedAmount = transaction.originalAmount ?? transaction.amount;
    const capturedCurrency = transaction.originalCurrency ?? transaction.currencyCode;
    setField("amountExpression", amountToExpression(capturedAmount, capturedCurrency, locale));
    setField("currency", capturedCurrency);
    // El rate con el que se guardó, para que reabrir y guardar no lo mueva
    // — `fx_rate` se congela (`CLAUDE.md`), y esta es la conversión de
    // captura, que sigue el mismo criterio.
    setField("captureFxRateOverride", transaction.originalRate);
    setField("accountId", transaction.accountId);
    setField("counterAccountId", transaction.counterAccountId);
    setField("categoryId", transaction.categoryId);
    setField("occurredAt", transaction.occurredAt);
    setField("note", transaction.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id]);

  // Aparte del efecto de arriba: `existingTagIds` llega de una query async
  // (`transactionTagsRepo`, sin datos embebidos en `TransactionRow`), así
  // que puede no estar lista todavía en el primer render de ese efecto.
  useEffect(() => {
    if (existingTagIds) setField("tagIds", existingTagIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id, existingTagIds]);

  // Mismo motivo — `payees` es otra query async y el `transaction` solo
  // guarda `payeeId`, no el nombre. Sin esto, editar un movimiento con
  // comercio abría el campo vacío y lo que se escribiera se perdía al
  // guardar (el bug reportado: "no aparecen las opciones precargadas ni
  // queda guardado lo que se escribe").
  useEffect(() => {
    if (!transaction.payeeId) return;
    const payee = payees.find((p) => p.id === transaction.payeeId);
    if (payee) {
      setField("payeeName", payee.name);
      setField("payeeId", payee.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id, transaction.payeeId, payees]);

  const account = accounts.find((a) => a.id === draft.accountId);
  const counterAccount = accounts.find((a) => a.id === draft.counterAccountId);

  const canSave = () => {
    if (!account) return false;
    if (!hasNonZeroAmount(draft.amountExpression, draft.currency || account.currencyCode, numberLocaleForUiLocale(locale))) return false;
    if (draft.kind === "transfer") return !!counterAccount;
    return !!draft.categoryId;
  };

  const doSave = async () => {
    if (!account) return;
    const latestDraft = draftStoreApi.getState().draft;
    const latestAccount = accounts.find((a) => a.id === latestDraft.accountId) ?? account;
    const latestCounterAccount = accounts.find((a) => a.id === latestDraft.counterAccountId);

    await updateTransactionFromDraft({ transactionId: transaction.id, draft: latestDraft, household, account: latestAccount, counterAccount: latestCounterAccount, existing: transaction, numberLocale: numberLocaleForUiLocale(locale) });
    invalidateTransactions();
    invalidateTransactionTags();
    toast(t("movements.editFlow.updated"));
  };

  // Un solo botón, en dos lugares: al lado de "=" en el paso del monto
  // (`AmountStep.footerButton`) y solo en el paso de categoría.
  const nextOrSaveButton = (
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
  );

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton
          icon={step === "category" ? "chevron-left" : "close"}
          ariaLabel={step === "category" ? t("capture.back") : t("capture.close")}
          onClick={() => (step === "category" ? setStep("amount") : onClose())}
          style={{ margin: -11 }}
        />
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
          householdId={household.id}
          onCounterFxRateChange={(rate) => setField("counterFxRateOverride", rate)}
          onCaptureFxRateChange={(rate) => setField("captureFxRateOverride", rate)}
          onOpenCurrencyPicker={() => setSheet("currency")}
          onKindChange={setKind}
          onAmountKey={(key) => (key === "clear" ? clearAmount() : key === "backspace" ? backspaceAmount() : appendToAmount(key === "," ? "," : key))}
          onAmountChange={(expression) => setField("amountExpression", expression)}
          onOpenAccountPicker={() => setSheet("account")}
          onOpenCounterAccountPicker={() => setSheet("counterAccount")}
          onInvertTransfer={() => {
            const from = draft.accountId;
            setField("accountId", draft.counterAccountId);
            setField("counterAccountId", from);
            setField("counterFxRateOverride", null);
          }}
          onQuickCategory={(category) => setField("categoryId", category.id)}
          onOpenCategoryPicker={() => setStep("category")}
          onOpenDetails={() => setSheet("details")}
          onVoice={() => toast(t("movements.editFlow.voiceUnavailable"))}
          onPhoto={() => toast(t("movements.editFlow.photoComingSoon"))}
          footerButton={nextOrSaveButton}
        />
      ) : (
        <>
          <CategoryStep
            categories={sameKindCategories}
            selectedId={draft.categoryId}
            onSelect={(c) => setField("categoryId", c.id)}
            onCreate={handleCreateCategory}
          />
          <div style={{ marginTop: "auto" }}>{nextOrSaveButton}</div>
        </>
      )}

      <CurrencyPickerSheet
        open={sheet === "currency"}
        onClose={() => setSheet("none")}
        accounts={accounts}
        transactions={transactions}
        accountCurrency={account?.currencyCode}
        value={draft.currency}
        onChange={(code) => {
          setField("currency", code);
          setField("captureFxRateOverride", null);
        }}
      />

      <AccountPickerSheet open={sheet === "account"} title={t("capture.accountPicker.sourceTitle")} accounts={accounts.filter((a) => a.id !== draft.counterAccountId)} onSelect={(a) => setField("accountId", a.id)} onClose={() => setSheet("none")} />
      <AccountPickerSheet
        open={sheet === "counterAccount"}
        title={t("capture.accountPicker.destinationTitle")}
        accounts={accounts.filter((a) => a.id !== draft.accountId)}
        onSelect={(a) => setField("counterAccountId", a.id)}
        onClose={() => setSheet("none")}
      />
      <DetailsSheet
        open={sheet === "details"}
        onClose={() => setSheet("none")}
        draft={draft}
        accounts={accounts}
        onSetField={setField}
        tags={tags}
        frequentTags={frequentTags}
        onCreateTag={handleCreateTag}
        payees={payees}
        frequentPayees={frequentPayees}
      />
    </ScreenShell>
  );
}
