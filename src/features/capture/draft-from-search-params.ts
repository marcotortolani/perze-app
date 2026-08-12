import type { CaptureDraft, CaptureKind } from "@/stores/capture-draft-store";

const PREFILLABLE_KINDS: readonly CaptureKind[] = ["income", "expense", "transfer"];

/**
 * Traduce los query params con los que puede llegar `/add` al prefill
 * inicial del `CaptureDraftProvider` — se llama UNA vez, antes de crear el
 * store (ver `capture-draft-store.ts`), nunca después: escribir sobre un
 * store ya montado es exactamente el patrón que perdía estos prefills
 * contra el reset-on-mount que existía antes.
 *
 * Dos orígenes distintos, mismo mecanismo:
 * - `prefillKind`/`prefillCounterAccountId`/`prefillAmountExpression`/
 *   `prefillCurrency`/`prefillAmountPinnedTo` — flujos que empujan a
 *   `/add` con algo ya decidido (p. ej. "pagar tarjeta": destino fijo,
 *   monto anclado al destino). `prefillKind` acepta los tres kinds, no
 *   solo `transfer` — antes el kind sugerido desde onboarding (A11 →
 *   ingreso, `/onboarding/first-expense` → gasto) se escribía aparte, a
 *   mano, con `useCaptureDraftStore.getState().setKind(...)` antes de
 *   navegar, y por eso también se perdía.
 * - `title`/`note`/`url` — el `share_target` del manifest (compartir
 *   desde otra app), que se vuelca a la nota del borrador.
 */
export function draftFromSearchParams(searchParams: URLSearchParams): Partial<CaptureDraft> {
  const prefill: Partial<CaptureDraft> = {};

  const prefillKind = searchParams.get("prefillKind");
  if (prefillKind && (PREFILLABLE_KINDS as readonly string[]).includes(prefillKind)) {
    prefill.kind = prefillKind as CaptureKind;
  }

  const prefillCounterAccountId = searchParams.get("prefillCounterAccountId");
  if (prefillCounterAccountId) prefill.counterAccountId = prefillCounterAccountId;

  const prefillAmountExpression = searchParams.get("prefillAmountExpression");
  if (prefillAmountExpression) prefill.amountExpression = prefillAmountExpression;

  const prefillCurrency = searchParams.get("prefillCurrency");
  if (prefillCurrency) prefill.currency = prefillCurrency;

  if (searchParams.get("prefillAmountPinnedTo") === "counterAccount") {
    prefill.amountPinnedTo = "counterAccount";
  }

  const shared = [searchParams.get("title"), searchParams.get("note"), searchParams.get("url")].filter(Boolean).join(" — ");
  if (shared) prefill.note = shared;

  return prefill;
}
