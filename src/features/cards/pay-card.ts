import type { AccountRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import type { NumberLocale } from "@/lib/money/parse";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money } from "@/lib/money/money";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { cardStatementsRepo, type CardStatement } from "@/lib/repos/card-statements-repo";
import { debtsRepo, type Debt } from "@/lib/repos/debts-repo";
import { saveDraftAsTransaction, resolveFxForAccountCurrency } from "@/features/capture/save-transaction";
import { isCreditCardAccount } from "@/lib/analytics/card-cycle";
import type { CaptureDraft } from "@/stores/capture-draft-store";

export class PayCardError extends Error {}

export interface PayCardParams {
  household: HouseholdRow;
  userId: string;
  card: AccountRow;
  source: AccountRow;
  amountExpression: string;
  numberLocale: NumberLocale;
  /** Deudas/planes de cuotas asociados a esta tarjeta (`useDebtsByAccount(card.id)`), para marcar cuotas del ciclo como pagas. */
  installmentDebts: readonly Debt[];
  /**
   * `true` cuando el usuario confirmó "con esto queda saldada" pese a que
   * el monto no coincide con lo esperado (`PayCardSheet`, reconciliación)
   * — genera un `adjustment` sobre la cuenta de la tarjeta por la
   * diferencia y fuerza el resumen a `paid`. `false`/`undefined`: pago
   * parcial normal, sin ajuste.
   */
  declareSettled?: boolean | undefined;
  /** Delta a reconciliar (`expected - applied`), solo se usa si `declareSettled`. */
  reconciliationDelta?: bigint | undefined;
  /** Texto de la nota del `adjustment` de reconciliación — lo resuelve el caller con `useTranslations()` (`cardCyclePage.settlementAdjustmentNote`); este módulo no es un componente y no puede llamar `t()`. */
  adjustmentNote: string;
  /**
   * Origen y destino en monedas distintas: el rate que `PayCardSheet` ya
   * mostró y, si el usuario lo ajustó (a mano o editando el monto de
   * origen), el que efectivamente se usó — nunca se vuelve a resolver acá
   * "por las dudas", porque eso podría diferir de lo que la pantalla
   * mostró justo antes de confirmar (WYSIWYG). `undefined`/`null` en
   * misma moneda, donde no aplica.
   */
  rateOverride?: bigint | null | undefined;
}

export interface PayCardResult {
  transaction: TransactionRow;
  statement: CardStatement | null;
  adjustment: TransactionRow | null;
}

/**
 * Único lugar que puede registrar un pago de tarjeta — reemplaza los dos
 * caminos que había antes (`handleSettle` en `/accounts/[id]/card`, que
 * vinculaba el pago pero quedaba permanentemente inalcanzable sin un
 * resumen; y `handlePayCard` en `/accounts/[id]`, siempre alcanzable pero
 * que nunca vinculaba nada). Los dos puntos de entrada de la UI
 * (`PayCardSheet`, montado desde ambas pantallas) llaman a esta única
 * función.
 */
export async function payCard(params: PayCardParams): Promise<PayCardResult> {
  const { household, userId, card, source, amountExpression, numberLocale, installmentDebts, declareSettled, reconciliationDelta, adjustmentNote, rateOverride } = params;

  // Mensajes de guarda en inglés técnico a propósito: son invariantes de
  // programación (`payCard()` solo se llama desde `PayCardSheet`, que ya
  // filtra las cuentas elegibles antes de que el usuario pueda tipear un
  // monto) — nunca deberían llegar a la UI. Si alguna vez lo hacen, es un
  // bug, no un mensaje que el usuario tenga que leer traducido.
  if (!isCreditCardAccount(card)) throw new PayCardError("card must be a credit_card account");
  if (isCreditCardAccount(source)) throw new PayCardError("source cannot be a credit_card account");
  if (source.id === card.id) throw new PayCardError("source and card must differ");
  if (source.archivedAt !== null) throw new PayCardError("source account is archived");

  // Si no hay resumen del ciclo actual todavía (el cron no corrió hoy, o la
  // cuenta es nueva), se abre acá mismo — pero si falla (offline:
  // `card_statements` vive solo en Supabase, sin espejo en Dexie) NO se
  // aborta: la transferencia se guarda igual, misma regla que rige
  // `needs_fx` ("guardar no puede fallar").
  const statement = await cardStatementsRepo.ensureCurrentCycle(card);

  // Pineado al DESTINO (la tarjeta): el monto tipeado es "cuánto tengo que
  // cubrir de la tarjeta", no "cuánto sale de mi cuenta de origen" — así
  // se compara en la misma moneda contra `statement.statementBalance`.
  // `handleSettle` pineaba al origen antes de esta unificación: en una
  // tarjeta en otra moneda que la cuenta de origen, el monto tipeado se
  // interpretaba en la moneda equivocada antes de compararlo.
  const draft: CaptureDraft = {
    kind: "transfer",
    amountExpression,
    currency: card.currencyCode,
    accountId: source.id,
    counterAccountId: card.id,
    counterFxRateOverride: rateOverride ?? null,
    amountPinnedTo: "counterAccount",
    categoryId: null,
    occurredAt: new Date().toISOString(),
    payeeName: "",
    note: "",
    tagIds: [],
    burstMode: false,
    burstCount: 0,
  };

  const transaction = await saveDraftAsTransaction({ draft, household, userId, account: source, counterAccount: card, numberLocale });
  const appliedToCard = transaction.counterAmount ?? transaction.amount;

  let adjustment: TransactionRow | null = null;
  if (statement) {
    await cardStatementsRepo.markPaid(statement.id, appliedToCard, transaction.id, declareSettled === true);

    if (declareSettled && reconciliationDelta !== undefined && reconciliationDelta !== 0n) {
      // Mismo literal `adjustment` que `/accounts/[id]/reconcile/page.tsx`
      // — no se inventa un mecanismo nuevo, se reusa el ya cerrado. Va
      // sobre la cuenta de la TARJETA (donde está la discrepancia), no la
      // de origen.
      // Mismo criterio que `/accounts/[id]/reconcile`: la resolución de FX
      // pasa por la cadena real (override → cotización del día → última
      // conocida → `pending`), nunca por un ternario "identity o pending"
      // a mano — este ajuste tampoco es una compra en otra moneda.
      const adjustmentFx = await resolveFxForAccountCurrency(household, card.currencyCode, money(reconciliationDelta, card.currencyCode), new Date().toISOString().slice(0, 10));
      adjustment = await transactionsRepo.create({
        householdId: household.id,
        createdBy: userId,
        kind: "adjustment",
        occurredAt: new Date().toISOString(),
        accountId: card.id,
        counterAccountId: null,
        amount: reconciliationDelta,
        currencyCode: card.currencyCode,
        originalAmount: null,
        originalCurrency: null,
        originalRate: null,
        ...adjustmentFx,
        counterAmount: null,
        counterCurrencyCode: null,
        counterFxRate: null,
        categoryId: null,
        payeeId: null,
        note: adjustmentNote,
        attachments: [],
        location: null,
        status: "cleared",
        visibility: card.visibility === "custom" ? "private" : card.visibility,
        recurringId: null,
        installmentGroupId: null,
        installmentNumber: null,
        installmentTotal: null,
        source: "manual",
      });
    }

    const plans = installmentDebts.filter((d) => d.kind === "installment_plan");
    for (const plan of plans) {
      const schedule = await debtsRepo.listSchedule(plan.id);
      const dueItems = schedule.filter((item) => !item.paidAt && item.dueDate >= statement.periodStart && item.dueDate <= statement.periodEnd);
      for (const item of dueItems) await debtsRepo.markInstallmentPaid(item.id, transaction.id);
    }
  }

  return { transaction, statement, adjustment };
}

/** `true` si el monto tipeado hoy es válido (mayor a cero) — mismo criterio que ya usaba `evaluateSettleAmount` en `card/page.tsx`. */
export function isValidPayAmount(expr: string, currency: string, numberLocale: NumberLocale): boolean {
  if (expr.trim() === "") return false;
  try {
    return evaluateKeypadExpression(expr, currency, numberLocale).amount > 0n;
  } catch {
    return false;
  }
}
