export type VoiceCaptureKind = "expense" | "income" | "transfer";

/** Resultado de interpretar una frase de voz — todo se muestra editable antes de confirmar. */
export interface ParsedVoiceCapture {
  amountExpression: string | null;
  payeeName: string | null;
  kind: VoiceCaptureKind | null;
  /** `null` = no se mencionó ninguna moneda reconocible — el monto queda en la moneda de la cuenta, como siempre. Nunca adivina entre monedas ambiguas (ver `detectCurrency`). */
  currencyCode: string | null;
}

// D33 — la lista original solo cubría 1ª persona singular ("gasté",
// "cobré"): "ingresaron 2500 dólares de sueldo" (3ª persona plural, el
// caso real reportado) no matcheaba nada y el kind quedaba `null`, así que
// el toggle gasto/ingreso nunca cambiaba. Suma las conjugaciones más
// comunes en las que alguien narra un movimiento propio, sin intentar ser
// un parser gramatical completo.
const EXPENSE_VERBS = ["gasté", "gaste", "gastó", "gasto", "gastaron", "pagué", "pague", "pagó", "pago", "pagaron", "compré", "compre", "compró", "compraron"];
const INCOME_VERBS = [
  "cobré",
  "cobre",
  "cobró",
  "cobraron",
  "recibí",
  "recibi",
  "recibió",
  "recibieron",
  "ingresé",
  "ingrese",
  "ingresó",
  "ingresaron",
  "entró",
  "entraron",
  "me pagaron",
  "me depositaron",
  "me depositó",
  "depositaron",
];
const TRANSFER_VERBS = ["transferí", "transferi", "transferió", "transfirieron", "moví", "movi", "movió", "movieron", "pasé de", "pase de", "pasó de"];

function detectKind(normalized: string): VoiceCaptureKind | null {
  if (TRANSFER_VERBS.some((v) => normalized.includes(v))) return "transfer";
  if (INCOME_VERBS.some((v) => normalized.includes(v))) return "income";
  if (EXPENSE_VERBS.some((v) => normalized.includes(v))) return "expense";
  return null;
}

/**
 * Solo las monedas sin ambigüedad razonable en español rioplatense —
 * "pesos" a secas se queda afuera de esta lista a propósito: puede ser
 * UYU, ARS, MXN o CLP según quién hable. `detectCurrency` recién resuelve
 * ese caso más abajo, usando la moneda base del household como
 * desambiguador — ahí sí es inambiguo, porque es la moneda del propio
 * usuario, no una adivinanza entre países. Ordenado de más a menos
 * específico para que "pesos uruguayos" no caiga en un match genérico
 * antes de tiempo.
 */
const CURRENCY_WORDS: Array<{ words: string[]; code: string }> = [
  { words: ["pesos uruguayos", "peso uruguayo"], code: "UYU" },
  { words: ["pesos argentinos", "peso argentino"], code: "ARS" },
  { words: ["pesos mexicanos", "peso mexicano"], code: "MXN" },
  { words: ["pesos chilenos", "peso chileno"], code: "CLP" },
  { words: ["dólares", "dolares", "dólar", "dolar", "usd"], code: "USD" },
  { words: ["euros", "euro", "eur"], code: "EUR" },
  { words: ["reales", "real brasileño", "brl"], code: "BRL" },
];

/** Monedas para las que "pesos" a secas (sin calificar de qué país) es un nombre válido. */
const BARE_PESO_CURRENCIES = new Set(["UYU", "ARS", "MXN", "CLP"]);

/**
 * `localCurrencyCode` es la moneda base del household de quien dicta — no
 * una adivinanza entre países, es la moneda de esa persona. Si dice
 * "pesos" sin calificar y esa moneda base es alguna de las de peso
 * latinoamericanas, es ESA la que quiso decir: nadie narra su propio gasto
 * calificando de qué país es su moneda. Solo aplica si `localCurrencyCode`
 * es efectivamente una moneda de "peso" — si el household usa dólares y
 * alguien dice "pesos" (mencionando otra moneda sin calificar), seguimos
 * sin adivinar.
 */
function detectCurrency(normalized: string, localCurrencyCode: string | null): string | null {
  for (const { words, code } of CURRENCY_WORDS) {
    if (words.some((w) => normalized.includes(w))) return code;
  }
  if (localCurrencyCode && BARE_PESO_CURRENCIES.has(localCurrencyCode) && /\bpesos?\b/.test(normalized)) {
    return localCurrencyCode;
  }
  return null;
}

/**
 * Parser mínimo de español rioplatense para C9: "gasté mil doscientos en
 * el súper", "pagué 450 de nafta", "ingresaron 2500 dólares de sueldo". No
 * pretende ser un NLP completo — todo lo interpretado queda en campos
 * editables antes de confirmar, así que un acierto parcial nunca bloquea
 * la carga.
 */
export function parseVoiceCapture(transcript: string, localCurrencyCode: string | null = null): ParsedVoiceCapture {
  const normalized = transcript.toLowerCase().trim();

  const numberMatch = normalized.match(/(\d+(?:[.,]\d+)?)/);
  const amountExpression = numberMatch ? (numberMatch[1] ?? null) : null;

  const enMatch = normalized.match(/\b(?:en|de)\s+(?:el|la|los|las)?\s*([a-záéíóúñ0-9\s]+)$/i);
  const payeeName = enMatch ? (enMatch[1]?.trim().replace(/\s+/g, " ") ?? null) : null;

  const kind = detectKind(normalized);
  const currencyCode = detectCurrency(normalized, localCurrencyCode);

  return { amountExpression, payeeName, kind, currencyCode };
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface VoiceCategoryMatch {
  categoryId: string;
  categoryName: string;
}

/**
 * Matchea el texto capturado después de "en"/"de" contra el nombre de una
 * categoría del household — substring simple, sin acentos ni mayúsculas,
 * en cualquiera de los dos sentidos ("transporte" ⊂ "Transporte", pero
 * también sirve si el nombre de la categoría es más específico que lo
 * dicho). No es fuzzy-matching real: si no hay coincidencia clara, no
 * matchea nada — la categoría se elige a mano en el paso siguiente, nunca
 * bloquea la carga.
 */
export function matchVoiceCategory(text: string | null, categories: readonly { id: string; name: string }[]): VoiceCategoryMatch | null {
  if (!text) return null;
  const needle = normalizeForMatch(text);
  if (!needle) return null;
  for (const category of categories) {
    const hay = normalizeForMatch(category.name);
    if (hay && (needle.includes(hay) || hay.includes(needle))) {
      return { categoryId: category.id, categoryName: category.name };
    }
  }
  return null;
}

export interface VoiceTagMatch {
  tagId: string;
  tagName: string;
}

/**
 * A diferencia de la categoría (una sola, `matchVoiceCategory`), los tags
 * no son mutuamente excluyentes — un movimiento puede llevar varios. Se
 * busca en la FRASE COMPLETA, no solo en lo que sigue a "en"/"de": un tag
 * como "reembolsable" puede mencionarse en cualquier parte ("gasté 500 en
 * el súper, es reembolsable"), no necesariamente donde cae el comercio.
 */
export function matchVoiceTags(transcript: string, tags: readonly { id: string; name: string }[]): VoiceTagMatch[] {
  const hay = normalizeForMatch(transcript);
  if (!hay) return [];
  const matches: VoiceTagMatch[] = [];
  for (const tag of tags) {
    const needle = normalizeForMatch(tag.name);
    if (needle && hay.includes(needle)) matches.push({ tagId: tag.id, tagName: tag.name });
  }
  return matches;
}
