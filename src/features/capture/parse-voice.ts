/** Resultado de interpretar una frase de voz — todo se muestra editable antes de confirmar. */
export interface ParsedVoiceCapture {
  amountExpression: string | null;
  payeeName: string | null;
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

  return { amountExpression, payeeName };
}
