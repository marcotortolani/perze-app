"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, IconButton, Keypad, ListRow, SegmentedControl, Sheet, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useAssetClasses, useInstruments, useInvalidateTrades, useTrades } from "@/hooks/use-investments";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { tradesRepo, type TradeKind } from "@/lib/repos/trades-repo";
import { createSettlementTransaction } from "@/lib/investments/create-settlement-transaction";
import { fxRepo } from "@/lib/repos/fx-repo";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { todayIso } from "@/lib/repos/ids";
import { convert } from "@/lib/fx/rate";
import { appendKeypadRateDigit } from "@/lib/fx/rate-keypad";
import { money } from "@/lib/money/money";
import { decimalsFor, decimalsForQuantity } from "@/lib/money/decimals";
import { formatNumber } from "@/lib/money/format";
import { computePositions } from "@/lib/analytics/positions";
import { tradeSettlementAccounts } from "@/lib/analytics/card-cycle";
import { tradeMovesCash } from "@/lib/investments/trade-settlement-policy";
import { decimalSeparatorForLocale, type Locale } from "@/i18n/formatting";
import type { Instrument } from "@/lib/repos/instruments-repo";

const KINDS = ["buy", "sell", "transfer_in"] as const satisfies readonly TradeKind[];

/**
 * `quantity`/`price` son `number` en `NewTradeInput` (no `ScaledRate`, no
 * `Money`) — `appendKeypadRateDigit` sirve igual porque es un acumulador de
 * dígitos genérico (ver su comentario), pero el parseo de vuelta es propio:
 * un `Number()` directo sobre el string ya normalizado, sin la escala de
 * `parseRate` que es específica de tipos de cambio.
 */
function parseKeypadDecimal(raw: string, decimalSeparator: string): number | null {
  if (raw === "" || raw === decimalSeparator) return null;
  const normalized = raw.replaceAll(decimalSeparator, ".");
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Para arrancar el teclado desde el valor actual, en la misma notación con la que se lo va a seguir editando. */
function toKeypadDigits(n: number, decimalSeparator: string): string {
  if (n === 0) return "";
  return String(n).replace(".", decimalSeparator);
}

/** I4-I7 — cargar una operación (compra/venta). Requiere un instrumento ya creado (I7b si hace falta). */
export default function NewTradePage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = use(params);
  const searchParams = useSearchParams();
  const prefillInstrumentId = searchParams.get("instrumentId");
  // D45/D47 — Next.js reusa esta MISMA instancia de página al navegar de
  // `?instrumentId=A` a `?instrumentId=B` (es la misma ruta, solo cambia
  // el search param): sin este `key`, el `useState` de instrumento/precio/
  // cantidad quedaba pegado del instrumento anterior. `key` fuerza un
  // remount limpio por cada instrumento distinto (o al no venir de
  // ninguno) — mismo criterio que "key={id} en el detalle" del recipe de
  // master-detail de `CLAUDE.md`, aplicado acá aunque esta ruta todavía no
  // sea master-detail en sí.
  return <NewTradeForm key={prefillInstrumentId ?? "none"} portfolioId={portfolioId} prefillInstrumentId={prefillInstrumentId} />;
}

interface NewTradeFormProps {
  portfolioId: string;
  prefillInstrumentId: string | null;
}

function NewTradeForm({ portfolioId, prefillInstrumentId }: NewTradeFormProps) {
  const t = useTranslations();
  // Labels ya resueltos, no un mapa de claves-string: `t()` exige una
  // clave literal conocida en build-time (`NamespacedMessageKeys`) — un
  // `Record<Kind, string>` de claves y un `t(map[kind])` posterior pierde
  // ese chequeo. Igual que `scopeLabels` en `(app)/layout.tsx`.
  const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
    buy: t("newTradePage.buy"),
    sell: t("newTradePage.sell"),
    transfer_in: t("newTradePage.transferIn"),
  };
  const locale = useLocale() as Locale;
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: instruments = [] } = useInstruments(household?.id);
  const { data: assetClasses = [] } = useAssetClasses();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: existingTrades = [] } = useTrades(portfolioId);
  const invalidateTrades = useInvalidateTrades(portfolioId);
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  usePageHeader({ title: t("investmentsPage.recordTrade"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [kind, setKind] = useState<TradeKind>("buy");
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  // Por qué el precio quedó vacío después de elegir instrumento — dos
  // casos distintos, con copy distinto (CLAUDE.md: "los errores proponen
  // la corrección, no la nombran"): un instrumento que nunca tuvo
  // proveedor (FCI, plazo fijo) vs. uno que sí tiene pero el proveedor no
  // devolvió nada (SpaceX en Finnhub — es una empresa privada, `/quote`
  // responde 200 sin precio). Antes los dos casos eran indistinguibles:
  // el campo quedaba vacío y el botón "Guardar" deshabilitado sin decir
  // por qué, así que SPCX-USD parecía un botón roto.
  const [priceUnavailable, setPriceUnavailable] = useState<"no-provider" | "provider-empty" | null>(null);
  const [sheet, setSheet] = useState<"none" | "instrument" | "account" | "quantity" | "price">("none");
  const [keypadDigits, setKeypadDigits] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // El precio arranca en el valor de mercado del momento, editable — nunca
  // se lo pide "de memoria". Un instrumento sin proveedor (FCI, plazo
  // fijo, inmuebles) deja el campo vacío como siempre, sin sugerencia.
  const handleSelectInstrument = async (inst: Instrument) => {
    setInstrumentId(inst.id);
    setSheet("none");
    setPrice("");
    if (!inst.priceProvider) {
      setPriceUnavailable("no-provider");
      return;
    }
    setPriceUnavailable(null);
    setPriceLoading(true);
    try {
      const quote = await priceSnapshotsRepo.refreshFromProvider(inst.id);
      if (quote) setPrice(String(quote.close));
      else setPriceUnavailable("provider-empty");
    } catch (error) {
      // Antes esto era un try/finally sin catch: un fallo real del
      // proveedor (red, 500) quedaba indistinguible de "este instrumento
      // simplemente no tiene precio".
      console.error("[trades/new] no se pudo obtener el precio de mercado", error);
      setPriceUnavailable("provider-empty");
    } finally {
      setPriceLoading(false);
    }
  };

  // I4 — "Registrar operación" desde el detalle de instrumento llega acá con
  // `?instrumentId=`, ya con ticket y precio de mercado conocidos: se
  // preselecciona una sola vez, por el mismo camino que elegirlo a mano en
  // la hoja, para no duplicar el fetch de cotización con otra lógica.
  // `instruments` puede tardar un tick en cargar, así que el efecto
  // reintenta hasta encontrarlo; el ref evita re-aplicar el prefill en
  // cada refetch de `instruments` una vez que ya se aplicó — el `key` del
  // componente padre ya garantiza que esto arranca en `false` por cada
  // instrumento distinto, así que no hace falta trackear el id anterior acá.
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || !prefillInstrumentId) return;
    const inst = instruments.find((i) => i.id === prefillInstrumentId);
    if (!inst) return;
    prefillApplied.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill único desde el query param, no un loop de sincronización de estado
    handleSelectInstrument(inst);
  }, [prefillInstrumentId, instruments]);

  if (!household || !userId) return null;

  const instrument = instruments.find((i) => i.id === instrumentId);
  const account = accounts.find((a) => a.id === accountId);
  const qty = Number(quantity.replace(",", "."));
  const unitPrice = Number(price.replace(",", "."));
  // D45 — unidades mínimas de la moneda del INSTRUMENTO, nunca un `* 100`
  // fijo (ARS/USD tienen 2 decimales hoy, pero un crypto con más no).
  const grossAmount =
    Number.isFinite(qty) && Number.isFinite(unitPrice) && instrument ? Math.round(qty * unitPrice * 10 ** decimalsFor(instrument.currencyCode)) : 0;
  // Vender más de lo que se tiene no es un error visible en `computePositions`:
  // una posición que queda en cantidad <= 0 se BORRA (se interpreta como
  // "cerrada"), así que una venta de más hace desaparecer la posición entera
  // en vez de fallar ruidosamente — hay que cortarlo acá, antes de guardar.
  const heldQuantity = instrument ? (computePositions(existingTrades).get(instrument.id)?.quantity ?? 0) : 0;
  const exceedsHeldQuantity = kind === "sell" && !!instrument && qty > heldQuantity;
  // La cuenta de liquidación solo hace falta si el trade mueve caja de
  // verdad — una posición inicial (`transfer_in`) registra algo que ya
  // tenías, sin que ninguna cuenta se toque.
  const requiresAccount = tradeMovesCash(kind);
  const canSave = !!instrument && (!requiresAccount || !!account) && qty > 0 && unitPrice > 0 && !exceedsHeldQuantity;
  const quantityDecimals = instrument
    ? decimalsForQuantity({
        symbol: instrument.symbol,
        ...(assetClasses.find((a) => a.id === instrument.assetClassId)?.name ? { assetClass: assetClasses.find((a) => a.id === instrument.assetClassId)!.name } : {}),
        ...(instrument.quantityDecimals !== null ? { decimals: instrument.quantityDecimals } : {}),
      })
    : 0;
  const formatQuantity = (n: number) => formatNumber(n, quantityDecimals);
  // Mismo cálculo que `exceedsHeldQuantity`, pero sobre lo que se está
  // tipeando en el keypad TODAVÍA no confirmado (`keypadDigits`) — para
  // avisar dentro del modal sin tener que cerrarlo primero.
  const keypadQty = sheet === "quantity" && keypadDigits !== null ? (parseKeypadDecimal(keypadDigits, decimalSeparator) ?? 0) : 0;
  const keypadExceedsHeldQuantity = kind === "sell" && !!instrument && keypadQty > heldQuantity;

  // ±1 unidad, nunca negativo — un CEDEAR fraccionario ("0.5") sigue
  // pudiendo tipearse a mano por el teclado, el stepper es para el caso
  // común de cantidades enteras.
  const adjustQuantity = (delta: number) => {
    const current = Number(quantity.replace(",", ".")) || 0;
    const next = Math.max(0, current + delta);
    setQuantity(next === 0 ? "" : String(next));
  };

  const openQuantityKeypad = () => {
    setKeypadDigits(toKeypadDigits(Number(quantity.replace(",", ".")) || 0, decimalSeparator));
    setSheet("quantity");
  };
  const openPriceKeypad = () => {
    setKeypadDigits(toKeypadDigits(Number(price.replace(",", ".")) || 0, decimalSeparator));
    setSheet("price");
  };
  const commitKeypad = () => {
    if (keypadDigits !== null) {
      const parsed = parseKeypadDecimal(keypadDigits, decimalSeparator);
      const raw = parsed !== null ? String(parsed) : "";
      if (sheet === "quantity") setQuantity(raw);
      else if (sheet === "price") {
        setPrice(raw);
        // El usuario ya resolvió el precio a mano — el aviso de "sin
        // precio de mercado" dejó de aplicar.
        if (raw !== "") setPriceUnavailable(null);
      }
    }
    setSheet("none");
    setKeypadDigits(null);
  };
  const cancelKeypad = () => {
    setSheet("none");
    setKeypadDigits(null);
  };

  const handleSave = async () => {
    if (!canSave || !instrument || saving) return;
    if (requiresAccount && !account) return;
    setSaving(true);
    try {
      // Firma del monto: `sell` es la única salida de plata — `buy` Y
      // `transfer_in` suman a la posición igual (ver `computePositions`),
      // así que las dos quedan en positivo.
      const netAmount = BigInt(kind === "sell" ? -grossAmount : grossAmount);
      let amountBase: bigint | null = null;
      let fxRate: string | null = null;
      // Siempre por `fxRepo.resolve()`, incluso en la misma moneda — es la
      // única fuente de la cadena de resolución, y para `base === quote`
      // devuelve `identity` con `rate = 1` de verdad (un hecho, no un dato
      // inventado tapando uno faltante). El bug real: el atajo manual de
      // acá reimplementaba ese caso a mano y dejaba `fxRate` en `null`
      // mientras `amountBase` sí quedaba puesto — viola
      // `trades_fx_pair CHECK ((fx_rate IS NULL) = (amount_base IS NULL))`
      // y el insert vuelve 400 en CUALQUIER trade en la moneda base del
      // household, no solo `transfer_in`.
      const resolution = await fxRepo.resolve({ householdId: household.id, base: instrument.currencyCode, quote: household.baseCurrency, date: todayIso() });
      let fxSource: "identity" | "api" | "manual" | "inherited" | "pending" = resolution.source;
      if (resolution.rate) {
        amountBase = convert(money(netAmount, instrument.currencyCode), household.baseCurrency, resolution.rate).amount;
        fxRate = resolution.rate.toString();
      } else {
        fxSource = "pending";
      }

      const trade = await tradesRepo.create({
        portfolioId,
        instrumentId: instrument.id,
        createdBy: userId,
        kind,
        executedAt: new Date().toISOString(),
        quantity: qty,
        price: unitPrice,
        currencyCode: instrument.currencyCode,
        grossAmount: BigInt(grossAmount),
        netAmount,
        settlementAccountId: account?.id ?? null,
        amountBase,
        fxRate,
        fxSource,
      });

      try {
        // Settlement — el bug reportado: antes `settlementAccountId` era
        // puramente informativo, nunca movía la cuenta ni dejaba rastro en
        // Transacciones. `kind: "investing"` (no una categoría — `categories.kind`
        // solo admite expense/income) ya está excluido de presupuestos y
        // "gasto por categoría", igual que transfer/adjustment.
        //
        // `tradeMovesCash`: una posición inicial (`transfer_in`) es lo
        // contrario del bug de arriba — no tiene que mover ninguna cuenta,
        // así que acá se salta la settlement a propósito.
        if (tradeMovesCash(kind) && account) {
          await createSettlementTransaction({
            household,
            userId,
            tradeId: trade.id,
            netAmount,
            instrumentCurrency: instrument.currencyCode,
            instrumentSymbol: instrument.symbol,
            accountId: account.id,
            accountCurrency: account.currencyCode,
            accountKind: account.kind,
          });
        }
      } catch (settlementError) {
        // El trade ya se creó — dejarlo así sería un trade "fantasma" que
        // movió la posición pero nunca la cuenta que dijo que iba a
        // mover. Se descarta entero y se avisa, en vez de quedar en un
        // estado a medias que nadie eligió.
        await tradesRepo.softDelete(trade.id);
        throw settlementError;
      }

      invalidateTrades();
      invalidateTransactions();
      toast(fxSource === "pending" ? t("newTradePage.savedPendingFx") : t("newTradePage.saved"));
      // `back()`, no `replace`/`push` — la lista ya está en el historial
      // justo debajo. `replace("/investments")` duplicaba esa misma
      // entrada.
      router.back();
    } catch (error) {
      // Antes esto era un try/finally sin catch: si `tradesRepo.create`
      // o la settlement fallaban (RLS, red), el botón simplemente volvía
      // a estar habilitado sin decir nada — parecía que no había pasado
      // nada, en vez de que algo falló de verdad.
      console.error("[trades/new] no se pudo guardar la operación", error);
      toast(t("newTradePage.saveError"));
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
          <SegmentedControl
            options={KINDS.map((k) => ({ id: k, label: KIND_LABEL[k] }))}
            value={kind}
            onChange={(k) => setKind(k as TradeKind)}
          />

          <button type="button" onClick={() => setSheet("instrument")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.instrument")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{instrument ? `${instrument.symbol} — ${instrument.name}` : t("newTradePage.chooseInstrument")}</div>
          </button>

          {requiresAccount ? (
            <button type="button" onClick={() => setSheet("account")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
              <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.settlementAccount")}</div>
              <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? `${account.name} · ${account.currencyCode}` : t("goalsPage.chooseAccount")}</div>
            </button>
          ) : (
            // `transfer_in` — posición inicial: no hay cuenta que elegir,
            // así que en vez del picker va la explicación de por qué no
            // la pide (CLAUDE.md: los errores/estados se explican, no se
            // dejan como un campo ausente sin motivo aparente).
            <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0, padding: "0 2px" }}>{t("newTradePage.transferInExplainer")}</p>
          )}

          {/* Cantidad: número centrado + ±1 a los costados — el caso común
              (comprar N unidades enteras) no necesita abrir el teclado. Tocar
              el número sí lo abre, para cantidades grandes o fraccionarias
              (CEDEARs). */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("newTradePage.quantity")}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <IconButton icon="minus" ariaLabel={t("newTradePage.decreaseQuantity")} onClick={() => adjustQuantity(-1)} />
              <button
                type="button"
                onClick={openQuantityKeypad}
                style={{ background: "none", border: 0, minWidth: 88, padding: "8px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--text-primary)", cursor: "pointer" }}
              >
                {quantity || "0"}
              </button>
              <IconButton icon="plus" ariaLabel={t("newTradePage.increaseQuantity")} onClick={() => adjustQuantity(1)} />
            </div>
            {/* "Los errores proponen la corrección, no la nombran" (CLAUDE.md):
                el máximo vendible se muestra siempre que hay instrumento
                elegido en modo venta, no solo cuando ya te pasaste. */}
            {kind === "sell" && instrument ? (
              <p className="t-caption" style={{ textAlign: "center", color: exceedsHeldQuantity ? "var(--critical)" : "var(--text-muted)", margin: 0 }}>
                {t("newTradePage.availableToSell", { quantity: formatQuantity(heldQuantity), symbol: instrument.symbol })}
              </p>
            ) : null}
          </div>

          {/* Precio: siempre por teclado numérico (no tiene sentido un
              stepper de ±1 sobre un precio), con la moneda del instrumento
              en la etiqueta — antes no se indicaba en qué moneda se estaba
              tipeando el precio. */}
          <button
            type="button"
            onClick={openPriceKeypad}
            style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}
          >
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
              {instrument ? t("newTradePage.unitPriceInCurrency", { currency: instrument.currencyCode }) : t("newTradePage.unitPrice")}
            </div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>
              {priceLoading ? t("newTradePage.loadingPrice") : price || "—"}
            </div>
          </button>
          {/* El botón "Guardar" queda deshabilitado con `price` vacío
              (`canSave`), pero sin este texto no había forma de saber POR
              QUÉ — este era exactamente el bug de SPCX: el botón se veía
              gris, sin ninguna pista de que el instrumento simplemente no
              tiene precio de mercado. */}
          {!priceLoading && !price && priceUnavailable ? (
            <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0, padding: "0 2px" }}>
              {t(priceUnavailable === "no-provider" ? "newTradePage.priceNoProvider" : "newTradePage.priceProviderEmpty", { currency: instrument?.currencyCode ?? "" })}
            </p>
          ) : null}

          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: "auto" }}>
            {t("common.save")}
          </Button>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={sheet === "instrument"} title={t("newTradePage.instrument")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {instruments.map((i) => (
            <ListRow key={i.id} label={`${i.symbol} — ${i.name}`} meta={i.currencyCode} onClick={() => handleSelectInstrument(i)} />
          ))}
          <ListRow icon="plus" label={t("investmentsPage.newInstrument")} variant="action" onClick={() => router.push(`/investments/${portfolioId}/instruments/new`)} />
        </div>
      </Sheet>
      <Sheet open={sheet === "account"} title={t("newTradePage.settlementAccount")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tradeSettlementAccounts(accounts, null).map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountId(a.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "quantity" || sheet === "price"} title={sheet === "quantity" ? t("newTradePage.quantity") : t("newTradePage.unitPrice")} onClose={cancelKeypad}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 32, color: keypadExceedsHeldQuantity ? "var(--critical)" : "var(--text-primary)" }}>
              {keypadDigits || "0"}
            </div>
            {/* Mismo aviso que el campo cerrado (CLAUDE.md: la corrección se
                propone, no se nombra después de cerrar el modal) — acá
                adentro, en vivo mientras se tipea, para no tener que cerrar,
                enterarse del error y volver a abrir. */}
            {sheet === "quantity" && kind === "sell" && instrument ? (
              <p className="t-caption" style={{ textAlign: "center", color: keypadExceedsHeldQuantity ? "var(--critical)" : "var(--text-muted)", margin: 0 }}>
                {t("newTradePage.availableToSell", { quantity: formatQuantity(heldQuantity), symbol: instrument.symbol })}
              </p>
            ) : null}
          </div>
          <Keypad
            operators={false}
            onKey={(key) => setKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))}
            onClear={() => setKeypadDigits("")}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="secondary" onClick={cancelKeypad} style={{ flex: 1 }}>
              {t("currenciesPage.keypadCancel")}
            </Button>
            <Button variant="primary" disabled={keypadExceedsHeldQuantity} onClick={commitKeypad} style={{ flex: 1 }}>
              {t("currenciesPage.keypadDone")}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
