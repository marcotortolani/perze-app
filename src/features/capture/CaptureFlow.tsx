"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { IconButton } from "@/design-system";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { MorphButton } from "@/components/motion";
import { ScreenShell } from "@/components/screen-shell";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories, useInvalidateCategories } from "@/hooks/use-categories";
import { useInvalidateAfterTransactionWrite, useTransactions } from "@/hooks/use-transactions";
import { useInvalidateTags, useTags } from "@/hooks/use-tags";
import { useInvalidateTransactionTags } from "@/hooks/use-transaction-tags";
import { usePayees } from "@/hooks/use-payees";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { tagsRepo } from "@/lib/repos/tags-repo";
import type { AccountRow } from "@/lib/db/schema";
import { CaptureDraftProvider, useCaptureDraftStore, useCaptureDraftStoreApi, type CaptureKind } from "@/stores/capture-draft-store";
import { useCaptureRecencyStore } from "@/stores/capture-recency-store";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { draftFromSearchParams } from "./draft-from-search-params";
import { AccountPickerSheet } from "./AccountPickerSheet";
import { CurrencyPickerSheet } from "./CurrencyPickerSheet";
import { AmountStep } from "./AmountStep";
import { CategoryStep } from "./CategoryStep";
import { DetailsSheet } from "./DetailsSheet";
import { VoiceCaptureSheet } from "./VoiceCaptureSheet";
import { computeExpenseDebitAmount, computeTransferDebitAmount, hasNonZeroAmount, resolveAmountCurrency, saveDraftAsTransaction } from "./save-transaction";
import { LIABILITY_ACCOUNT_KINDS } from "@/lib/analytics/balances";
import { useSuggestedFxRate } from "@/hooks/use-fx-rate";
import { buildNewCategoryInput } from "./create-category";
import { useFrequentCategories } from "./use-frequent-categories";
import { dedupeCategoriesByIdentity } from "@/lib/analytics/category-usage";
import { useFrequentTags } from "./use-frequent-tags";
import { useFrequentPayees } from "./use-frequent-payees";

type Step = "amount" | "category";
type SheetKind = "none" | "account" | "counterAccount" | "currency" | "details" | "voice";

/** Resultado que `onClose` reporta — necesario para la máquina de estados
 *  del primer movimiento (`src/lib/onboarding/first-tx-machine.ts`), que
 *  necesita distinguir "guardó y cerró" de "cerró sin guardar nada". */
export type CaptureCloseResult = { saved: true; kind: CaptureKind } | { saved: false };

export interface CaptureFlowProps {
  onClose?: ((result: CaptureCloseResult) => void) | undefined;
}

/**
 * Bloque C completo: C1 (monto), C2 (categoría, fallback), C3 (detalles),
 * C6 (transferencia), C7 (guardado + deshacer), C8 (ráfaga), C9 (voz).
 * C4 (moneda distinta a la de la cuenta) y C10 (foto) quedan fuera de
 * este paso — ver `save-transaction.ts` y el botón de cámara.
 *
 * Invariante duro: guardar no puede fallar. El guardado es local
 * (Dexie); la red es un detalle de otra capa.
 *
 * El prefill de query params (share target, "pagar tarjeta", kind
 * sugerido desde onboarding) se resuelve ACÁ, antes de crear el store del
 * draft — nunca escrito encima de un store ya montado (ver el comentario
 * de `CaptureDraftProvider`).
 */
export function CaptureFlow({ onClose }: CaptureFlowProps) {
  const searchParams = useSearchParams();
  const [initialDraft] = useState(() => draftFromSearchParams(searchParams));
  return (
    <CaptureDraftProvider initial={initialDraft}>
      <CaptureFlowInner onClose={onClose} />
    </CaptureDraftProvider>
  );
}

function CaptureFlowInner({ onClose }: CaptureFlowProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { data: household } = useCurrentHousehold();
  // `useEffectiveUserId` y no `useCurrentUserId`: el gate de más abajo
  // (`if (!household || !userId)`) deja la captura en "Cargando…" para
  // siempre cuando no hay sesión de Supabase — el caso del modo demo, que
  // nunca crea una. O sea que en demo no se podía cargar un gasto, que es
  // LA métrica del producto. Es el caso exacto que documenta
  // `use-current-user.ts`: sustituye por `DEMO_USER_ID` solo cuando el
  // tri-estado ya confirmó que no hay sesión, así que no reabre el bug B3
  // de escrituras con `created_by` inventado.
  const userId = useEffectiveUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const { data: tags = [] } = useTags(household?.id);
  const { data: payees = [] } = usePayees(household?.id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const invalidateCategories = useInvalidateCategories(household?.id);
  const invalidateTags = useInvalidateTags(household?.id);
  const invalidateTransactionTags = useInvalidateTransactionTags();
  const frequentTags = useFrequentTags(tags, (transactions ?? []).map((tx) => tx.id));
  const frequentPayees = useFrequentPayees(payees, transactions);
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
  const recordSave = useCaptureRecencyStore((s) => s.recordSave);
  const reset = useCaptureDraftStore((s) => s.reset);
  const draftStoreApi = useCaptureDraftStoreApi();

  const [step, setStep] = useState<Step>("amount");
  const [sheet, setSheet] = useState<SheetKind>("none");
  // `null` hasta el primer guardado exitoso de este montaje — le da a
  // `handleCancel` (que también dispara en modo ráfaga: guardar ×3 y
  // después ✕) forma de reportar "sí se guardó algo" en vez de "cancelado".
  const lastSavedKind = useRef<CaptureKind | null>(null);

  // Cuenta por defecto: la de el último movimiento cargado, no
  // `accounts[0]` (un orden sin ningún criterio — ni siquiera el
  // `sortOrder` que sí respeta la lista de `/accounts`). Quien paga
  // siempre con el mismo medio no tiene que reelegirlo cada vez.
  // `transactions` ya viene ordenada por `occurredAt` descendente
  // (`transactionsRepo.list`), así que el primer elemento es el último
  // cargado — sin query aparte. Si esa cuenta ya no existe (archivada/
  // borrada) o todavía no hay ningún movimiento, cae a `accounts[0]`.
  // Se resuelve derivado, nunca escribiendo al store durante el render: si
  // el usuario no eligió ninguna, `doSave` cae a esta misma cuenta por
  // default sin necesidad de persistirla antes de guardar. En una
  // transferencia NO se aplica este fallback: elegir el origen es una
  // decisión real de plata (de qué cuenta sale), nunca un default
  // silencioso — antes `accounts[0]` quedaba de "origen" sin que el
  // usuario lo hubiera tocado, incluso en flujos precargados como
  // "pagar tarjeta" donde el pedido es justamente dejarlo sin elegir.
  const lastUsedAccountId = (transactions ?? [])[0]?.accountId;
  const defaultAccount = accounts.find((a) => a.id === lastUsedAccountId) ?? accounts[0];
  const account = accounts.find((a) => a.id === draft.accountId) ?? (draft.kind === "transfer" ? undefined : defaultAccount);
  const counterAccount = accounts.find((a) => a.id === draft.counterAccountId);
  // Mismo hook que usa `AmountStep` para el `FxEditor` — mismo `queryKey`,
  // TanStack Query lo cachea entre los dos, no duplica el pedido de red.
  // Se necesita acá para el gate de saldo insuficiente, independiente de
  // que `AmountStep` lo use para su propia vista previa.
  const suggestedRate = useSuggestedFxRate(household?.id, account?.currencyCode, counterAccount?.currencyCode);

  // Moneda por defecto: mismo criterio que la cuenta arriba (último
  // movimiento cargado), pero acá sí hay que escribir al store una vez
  // resueltos los datos, porque `""` es un valor válido y ambiguo —
  // significa tanto "todavía no se tocó" como "elegí explícitamente la
  // misma moneda de la cuenta" (`CurrencyPickerSheet`). Sin esta escritura
  // no hay forma de distinguir los dos casos derivando en cada render, a
  // diferencia de `accountId` que arranca en `null`. Se aplica una sola vez
  // por montaje (guardado en el ref) y solo si la última moneda usada fue
  // distinta a la de la cuenta por defecto — si coinciden, `""` ya resuelve
  // exactamente lo mismo sin necesidad de fijarla.
  const appliedDefaultCurrencyRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultCurrencyRef.current || draft.kind === "transfer") return;
    if (transactions === undefined) return;
    appliedDefaultCurrencyRef.current = true;
    if (draft.currency) return;
    const last = transactions[0];
    const lastUsedCurrency = last?.originalCurrency ?? last?.currencyCode;
    if (lastUsedCurrency && lastUsedCurrency !== defaultAccount?.currencyCode) {
      setField("currency", lastUsedCurrency);
    }
  }, [transactions, draft.currency, draft.kind, defaultAccount, setField]);

  // La OTRA conversión (`CLAUDE.md` § "son dos conversiones, no una"): de
  // la moneda en que se tipeó a la de la cuenta. Solo existe cuando el
  // usuario eligió una moneda distinta a la de su cuenta — pagar 4.200 UYU
  // con la tarjeta en USD. Mismo `queryKey` que el de `AmountStep`, así que
  // TanStack Query no duplica el pedido.
  const capturedCurrency = resolveAmountCurrency(draft, account, counterAccount);
  const captureRate = useSuggestedFxRate(household?.id, capturedCurrency, account?.currencyCode);

  const categoryKind = draft.kind === "income" ? "income" : "expense";
  const sameKindCategories = dedupeCategoriesByIdentity(categories.filter((c) => c.kind === categoryKind), transactions ?? []);
  const frequentCategories = useFrequentCategories(categories, transactions, categoryKind, now, 5);

  const handleCreateCategory = async (name: string) => {
    if (!household || !userId) throw new Error("no household o sin sesión");
    const created = await categoriesRepo.create(
      buildNewCategoryInput({ householdId: household.id, name, kind: categoryKind, createdBy: userId, existing: sameKindCategories })
    );
    invalidateCategories();
    return created;
  };

  const handleCreateTag = async (name: string) => {
    if (!household) throw new Error("sin household");
    const created = await tagsRepo.create(household.id, name);
    invalidateTags();
    return created;
  };

  const handleAmountKey = (key: string) => {
    if (key === "clear") clearAmount();
    else if (key === "backspace") backspaceAmount();
    else appendToAmount(key === "," ? "," : key);
  };

  // Saldo insuficiente en un gasto: solo bloquea en cuentas de liquidez
  // real (caja de ahorro, billetera, crypto, etc.) — una tarjeta de
  // crédito o un préstamo (`LIABILITY_ACCOUNT_KINDS`) puede ir en negativo
  // por diseño, así que ahí nunca se bloquea.
  const expenseInsufficientFunds = () => {
    if (draft.kind !== "expense" || !account || LIABILITY_ACCOUNT_KINDS.has(account.kind)) return false;
    const debit = computeExpenseDebitAmount(draft, account, captureRate.data?.rate ?? null, numberLocaleForUiLocale(locale));
    return debit !== null && debit > account.currentBalance;
  };

  const canSave = () => {
    if (!household || !account || !userId) return false;
    // Elegir la categoría primero y dejar el monto en 0 no debería poder
    // guardar — un movimiento en $0 no significa nada.
    if (!hasNonZeroAmount(draft.amountExpression, resolveAmountCurrency(draft, account, counterAccount), numberLocaleForUiLocale(locale))) return false;
    if (draft.kind === "transfer") {
      if (!counterAccount) return false;
      // Saldo insuficiente: no se permite dejar una cuenta en negativo por
      // una transferencia a otra cuenta propia — mismo criterio que el
      // gasto de abajo, salvo que acá no hay excepción por tipo de cuenta:
      // el origen de una transferencia nunca es una tarjeta de crédito.
      const debit = computeTransferDebitAmount(draft, account, counterAccount, suggestedRate.data?.rate ?? null, numberLocaleForUiLocale(locale));
      if (debit !== null && debit > account.currentBalance) return false;
      return true;
    }
    if (expenseInsufficientFunds()) return false;
    return !!draft.categoryId;
  };

  const doSave = async () => {
    // B3 — nunca escribir con un uid que no sea real: `undefined` (todavía
    // cargando) y `null` (sin sesión) bloquean el guardado igual. Distinto
    // del PIN pre-auth (CLAUDE.md): esto es la sesión de Supabase, no el
    // bloqueo local — sin ella, la escritura jamás va a pasar RLS.
    if (!household || !account || !userId) return;
    // Se lee `getState()` en vez del `draft` reactivo de este closure: si
    // esta función corre justo después de un `setField` (p. ej. el chip de
    // categoría frecuente), el closure todavía tendría el valor viejo.
    const latestDraft = draftStoreApi.getState().draft;
    const latestAccount = accounts.find((a) => a.id === latestDraft.accountId) ?? account;
    const latestCounterAccount = accounts.find((a) => a.id === latestDraft.counterAccountId);

    const tx = await saveDraftAsTransaction({
      draft: latestDraft,
      household,
      userId,
      account: latestAccount,
      counterAccount: latestCounterAccount,
      numberLocale: numberLocaleForUiLocale(locale),
    });
    invalidateTransactions();
    if (latestDraft.tagIds.length > 0) invalidateTransactionTags();
    // B14 — habilita los 60s de edición sin PIN sobre este movimiento puntual.
    recordSave(tx.id);
    lastSavedKind.current = latestDraft.kind;

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
      onClose?.({ saved: true, kind: lastSavedKind.current ?? draft.kind });
    }
  };

  const handleCancel = () => {
    if (step === "category") {
      setStep("amount");
      return;
    }
    reset();
    onClose?.(lastSavedKind.current ? { saved: true, kind: lastSavedKind.current } : { saved: false });
  };

  if (!household || !userId) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <p className="t-body" style={{ color: "var(--text-secondary)" }}>
          {t("common.loading")}
        </p>
      </ScreenShell>
    );
  }

  // Un solo botón, en dos lugares: al lado de "=" en el paso del monto
  // (`AmountStep.footerButton`) y solo en el paso de categoría, donde no
  // hay keypad con quien compartir fila.
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
      onComplete={handleAfterSaveComplete}
    >
      {step === "amount" && draft.kind !== "transfer" && !draft.categoryId ? t("capture.next") : t("capture.save")}
    </MorphButton>
  );

  return (
    <ScreenShell
      style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton
          icon={step === "category" ? "chevron-left" : "close"}
          ariaLabel={step === "category" ? t("capture.back") : t("capture.close")}
          onClick={handleCancel}
          style={{ margin: -11 }}
        />
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
          householdId={household.id}
          onCounterFxRateChange={(rate) => setField("counterFxRateOverride", rate)}
          onCaptureFxRateChange={(rate) => setField("captureFxRateOverride", rate)}
          onOpenCurrencyPicker={() => setSheet("currency")}
          onKindChange={setKind}
          onAmountKey={handleAmountKey}
          onAmountChange={(expression) => setField("amountExpression", expression)}
          onOpenAccountPicker={() => setSheet("account")}
          onOpenCounterAccountPicker={() => setSheet("counterAccount")}
          onInvertTransfer={() => {
            const from = draft.accountId;
            setField("accountId", draft.counterAccountId);
            setField("counterAccountId", from);
            // Invertir el par también invierte a qué lado corresponde el
            // rate — más simple y seguro pedirlo de nuevo que arrastrar un
            // ajuste manual que ya no aplica al par nuevo.
            setField("counterFxRateOverride", null);
            // Un monto anclado al destino (p. ej. "pagar tarjeta") deja de
            // tener sentido apenas se invierte el par — vuelve al default
            // en vez de arrastrar un pin que ya no describe lo que se ve.
            setField("amountPinnedTo", "account");
          }}
          onQuickCategory={async (category) => {
            setField("categoryId", category.id);
            // Atajo rápido: si ya hay un monto tipeado, un chip de
            // categoría guarda directo (ahorra el paso de tocar
            // "Guardar"). Si el monto todavía está en 0 — categoría
            // elegida ANTES de tipear el monto — no hay nada que guardar
            // todavía: la categoría queda marcada y el botón de abajo
            // pasa a "Guardar" (ya no "Siguiente", `canSave()` lo
            // habilita recién cuando el monto deje de ser cero.
            if (!hasNonZeroAmount(draft.amountExpression, resolveAmountCurrency(draft, account, counterAccount), numberLocaleForUiLocale(locale))) return;
            // Mismo gate que el botón "Guardar" — el atajo rápido no puede
            // saltearse el bloqueo de saldo insuficiente.
            if (expenseInsufficientFunds()) return;
            await doSave();
            handleAfterSaveComplete();
          }}
          onOpenCategoryPicker={() => setStep("category")}
          onOpenDetails={() => setSheet("details")}
          onVoice={() => setSheet("voice")}
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
          // Cambiar de moneda invalida un rate tocado a mano para el par
          // anterior: dejarlo puesto aplicaría la tasa de USD/UYU a un par
          // que ya no es ese, en silencio.
          setField("captureFxRateOverride", null);
        }}
      />

      <AccountPickerSheet
        open={sheet === "account"}
        title={t("capture.accountPicker.sourceTitle")}
        accounts={accounts.filter((a: AccountRow) => a.id !== draft.counterAccountId)}
        onSelect={(a) => {
          setField("accountId", a.id);
          setField("counterFxRateOverride", null);
          // Mismo motivo: cambiar de cuenta cambia el par de la conversión
          // de captura, así que un rate tocado a mano deja de aplicar.
          setField("captureFxRateOverride", null);
          // Un origen recién elegido en una transferencia precargada (p. ej.
          // "pagar tarjeta") vuelve a interpretar el monto en SU moneda, no
          // en la que traía el prefill — evita una doble conversión que
          // nadie ve (captura→origen silenciosa más origen→destino ajustable).
          if (draft.kind === "transfer") setField("currency", "");
        }}
        onClose={() => setSheet("none")}
      />
      <AccountPickerSheet
        open={sheet === "counterAccount"}
        title={t("capture.accountPicker.destinationTitle")}
        accounts={accounts.filter((a: AccountRow) => a.id !== draft.accountId)}
        onSelect={(a) => {
          setField("counterAccountId", a.id);
          setField("counterFxRateOverride", null);
        }}
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
      <VoiceCaptureSheet
        open={sheet === "voice"}
        onClose={() => setSheet("none")}
        categories={categories}
        tags={tags}
        localCurrencyCode={household?.baseCurrency ?? null}
        onApply={({ amountExpression, payeeName, kind: voiceKind, categoryId, currencyCode, tagIds }) => {
          if (amountExpression) setField("amountExpression", amountExpression);
          if (payeeName) setField("payeeName", payeeName);
          if (voiceKind) setKind(voiceKind);
          if (categoryId) setField("categoryId", categoryId);
          if (tagIds.length > 0) setField("tagIds", tagIds);
          // D33 — "ingresaron 2500 dólares de sueldo": si hay UNA sola
          // cuenta en esa moneda, es el destino obvio (nadie tiene que
          // elegir entre una opción). Con cero o más de una, adivinar cuál
          // es peor que no tocar nada — el monto entra como "moneda
          // original" sobre la cuenta ya elegida (mismo mecanismo que el
          // prefill de "pagar tarjeta"), convertido a la moneda de la
          // cuenta, y el usuario cambia de cuenta a mano si no era esa.
          if (currencyCode && (voiceKind ?? draft.kind) !== "transfer" && currencyCode !== account?.currencyCode) {
            const matches = accounts.filter((a: AccountRow) => a.currencyCode === currencyCode);
            if (matches.length === 1) {
              setField("accountId", matches[0]!.id);
              setField("currency", "");
            } else {
              setField("currency", currencyCode);
            }
          }
        }}
      />
    </ScreenShell>
  );
}
