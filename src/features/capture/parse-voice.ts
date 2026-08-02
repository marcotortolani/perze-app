export type VoiceCaptureKind = "expense" | "income" | "transfer";

/** Resultado de interpretar una frase de voz — todo se muestra editable antes de confirmar. */
export interface ParsedVoiceCapture {
  amountExpression: string | null;
  payeeName: string | null;
  kind: VoiceCaptureKind | null;
}

const EXPENSE_VERBS = ["gasté", "gaste", "pagué", "pague", "compré", "compre"];
const INCOME_VERBS = ["cobré", "cobre", "recibí", "recibi", "ingresé", "ingrese", "me pagaron", "me depositaron"];
const TRANSFER_VERBS = ["transferí", "transferi", "moví", "movi", "pasé de", "pase de"];

function detectKind(normalized: string): VoiceCaptureKind | null {
  if (TRANSFER_VERBS.some((v) => normalized.includes(v))) return "transfer";
  if (INCOME_VERBS.some((v) => normalized.includes(v))) return "income";
  if (EXPENSE_VERBS.some((v) => normalized.includes(v))) return "expense";
  return null;
}

/**
 * Parser mínimo de español rioplatense para C9: "gasté mil doscientos en
 * el súper", "pagué 450 de nafta". No pretende ser un NLP completo — todo
 * lo interpretado queda en campos editables antes de confirmar, así que
 * un acierto parcial nunca bloquea la carga.
 */
export function parseVoiceCapture(transcript: string): ParsedVoiceCapture {
  const normalized = transcript.toLowerCase().trim();

  const numberMatch = normalized.match(/(\d+(?:[.,]\d+)?)/);
  const amountExpression = numberMatch ? (numberMatch[1] ?? null) : null;

  const enMatch = normalized.match(/\b(?:en|de)\s+(?:el|la|los|las)?\s*([a-záéíóúñ0-9\s]+)$/i);
  const payeeName = enMatch ? (enMatch[1]?.trim().replace(/\s+/g, " ") ?? null) : null;

  const kind = detectKind(normalized);

  return { amountExpression, payeeName, kind };
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
