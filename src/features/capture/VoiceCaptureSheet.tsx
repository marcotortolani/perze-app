"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Sheet } from "@/design-system";
import { matchVoiceCategory, parseVoiceCapture, type VoiceCaptureKind, type VoiceCategoryMatch } from "./parse-voice";

export interface VoiceCategoryOption {
  id: string;
  name: string;
  kind: "expense" | "income";
}

export interface VoiceCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  /** Categorías del household — se filtran por el `kind` detectado antes de intentar matchear. */
  categories: readonly VoiceCategoryOption[];
  onApply: (result: { amountExpression: string; payeeName: string; kind: VoiceCaptureKind | null; categoryId: string | null }) => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string | undefined }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Antes `onerror` descartaba el evento entero y solo apagaba `listening` —
 * sin distinguir "no soportado" (rama aparte, `unsupported`) de "soportado
 * pero falló" (permiso de micrófono denegado, sin micrófono, sin red, no
 * se entendió nada). En PWA instalada el permiso de micrófono es el
 * sospechoso más probable — WebSpeech corre igual, pero sin el prompt de
 * permiso que sí aparece en una pestaña normal queda en `not-allowed` en
 * silencio. Mapear el código real de error da al usuario algo que hacer
 * en vez de un botón que "no hace nada".
 */
const ERROR_MESSAGE_KEY: Record<string, string> = {
  "not-allowed": "capture.voice_sheet.errors.notAllowed",
  "service-not-allowed": "capture.voice_sheet.errors.notAllowed",
  "no-speech": "capture.voice_sheet.errors.noSpeech",
  "audio-capture": "capture.voice_sheet.errors.noMic",
  network: "capture.voice_sheet.errors.network",
};

/** C9 — captura por voz. Todo lo interpretado queda editable antes de confirmar; degrada limpio si el navegador no la soporta. */
export function VoiceCaptureSheet({ open, onClose, categories, onApply }: VoiceCaptureSheetProps) {
  const t = useTranslations();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [amountExpression, setAmountExpression] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [kind, setKind] = useState<VoiceCaptureKind | null>(null);
  const [matchedCategory, setMatchedCategory] = useState<VoiceCategoryMatch | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = !!getSpeechRecognition();

  useEffect(() => {
    // Solo detiene el reconocimiento en curso — el estado (transcript,
    // campos) se reinicia remontando el componente (`key` en el padre),
    // no acá: evita el setState síncrono dentro del efecto.
    if (!open) recognitionRef.current?.stop();
  }, [open]);

  const startListening = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    setErrorKey(null);
    const recognition = new Recognition();
    // Fijo en es-UY: `parseVoiceCapture` solo entiende español rioplatense
    // (ver el comentario de `parse-voice.ts`) — cambiarlo desalinearía el
    // reconocimiento del audio con lo que el parser puede interpretar.
    recognition.lang = "es-UY";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(text);
      const parsed = parseVoiceCapture(text);
      if (parsed.amountExpression) setAmountExpression(parsed.amountExpression);
      if (parsed.payeeName) setPayeeName(parsed.payeeName);
      setKind(parsed.kind);
      // Transferencia no tiene categoría — para el resto, filtrar por el
      // kind detectado (default gasto) evita matchear "sueldo" en un gasto.
      const candidateKind = parsed.kind === "income" ? "income" : "expense";
      setMatchedCategory(parsed.kind === "transfer" ? null : matchVoiceCategory(parsed.payeeName, categories.filter((c) => c.kind === candidateKind)));
    };
    recognition.onerror = (event) => {
      setErrorKey(ERROR_MESSAGE_KEY[event.error ?? ""] ?? "capture.voice_sheet.errors.other");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // `InvalidStateError` u otro throw síncrono — mismo tratamiento que
      // un `onerror` asíncrono, para no dejar el botón "colgado".
      setErrorKey("capture.voice_sheet.errors.other");
    }
  };

  return (
    <Sheet open={open} title={t("capture.voice_sheet.title")} onClose={onClose} height={360}>
      {!supported ? (
        <p className="t-body" style={{ color: "var(--text-secondary)" }}>
          {t("capture.voice_sheet.unsupported")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button
            type="button"
            onClick={startListening}
            disabled={listening}
            aria-label={t("capture.voice_sheet.startListening")}
            style={{
              alignSelf: "center",
              width: 72,
              height: 72,
              borderRadius: 999,
              border: 0,
              background: listening ? "var(--critical)" : "var(--primary-fill)",
              color: "var(--primary-on-fill)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon name="mic" size={28} />
          </button>
          <p className="t-body" style={{ textAlign: "center", color: errorKey ? "var(--critical)" : "var(--text-secondary)" }}>
            {listening ? t("capture.voice_sheet.listening") : errorKey ? (t as (key: string) => string)(errorKey) : transcript || t("capture.voice_sheet.prompt")}
          </p>
          {transcript ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p className="t-label" style={{ color: "var(--text-muted)", margin: 0 }}>
                  {t("capture.voice_sheet.summary", {
                    amount: amountExpression || t("capture.voice_sheet.empty"),
                    payee: payeeName || t("capture.voice_sheet.empty"),
                  })}
                </p>
                <p className="t-label" style={{ color: "var(--text-muted)", margin: 0 }}>
                  {`${t("capture.voice_sheet.kindLabel")}: ${kind ? t(`capture.kind.${kind}`) : t("capture.voice_sheet.empty")}`}
                </p>
                {kind !== "transfer" ? (
                  <p className="t-label" style={{ color: "var(--text-muted)", margin: 0 }}>
                    {`${t("capture.voice_sheet.categoryLabel")}: ${matchedCategory ? matchedCategory.categoryName : t("capture.voice_sheet.categoryUnmatched")}`}
                  </p>
                ) : null}
              </div>
              <Button
                onClick={() => {
                  onApply({ amountExpression, payeeName, kind, categoryId: matchedCategory?.categoryId ?? null });
                  onClose();
                }}
              >
                {t("capture.voice_sheet.useThis")}
              </Button>
            </>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
