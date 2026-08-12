import type { Instrument } from "@/lib/repos/instruments-repo";

export interface InstrumentIdentity {
  symbol: string;
  priceProvider: string | null;
  currencyCode: string;
}

/**
 * "¿Ya lo tenés?" para el alta de instrumentos (I7) — la clave de
 * identidad es `(symbol, priceProvider, currencyCode)`, las TRES, no
 * `(symbol, priceProvider)`. El caso real que rompía con dos: SPCX existe
 * como CEDEAR en ARS (`arg_cedears`) y como acción en USD
 * (`arg_stocks`/variante) del MISMO proveedor data912 — mismo símbolo,
 * mismo `priceProvider`, moneda distinta, son dos instrumentos
 * distintos. Sin la moneda en la clave, el segundo se consideraba "ya
 * existe" y no se creaba nada — ni error ni instrumento nuevo, solo un
 * toast de "creado" mintiendo y un `router.back()` a una pantalla que
 * después no encontraba el instrumento que el usuario acababa de "crear".
 */
export function findExistingInstrument(existing: readonly Instrument[], candidate: InstrumentIdentity): Instrument | undefined {
  return existing.find((i) => i.symbol === candidate.symbol && i.priceProvider === candidate.priceProvider && i.currencyCode === candidate.currencyCode);
}
