"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useTransform } from "motion/react";
import { Button, Icon, Sheet } from "@/design-system";
import { useMotionIntensity } from "@/components/motion/use-motion-intensity";
import { matchVoiceCategory, matchVoiceTags, parseVoiceCapture, type VoiceCaptureKind, type VoiceCategoryMatch, type VoiceTagMatch } from "./parse-voice";
import { useMicLevel } from "./use-mic-level";

export interface VoiceCategoryOption {
  id: string;
  name: string;
  kind: "expense" | "income";
}

export interface VoiceTagOption {
  id: string;
  name: string;
}

export interface VoiceCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  /** Categorías del household — se filtran por el `kind` detectado antes de intentar matchear. */
  categories: readonly VoiceCategoryOption[];
  /** Tags del household — a diferencia de la categoría, pueden matchear varios a la vez. */
  tags: readonly VoiceTagOption[];
  onApply: (result: { amountExpression: string; payeeName: string; kind: VoiceCaptureKind | null; categoryId: string | null; currencyCode: string | null; tagIds: string[] }) => void;
}

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
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
export function VoiceCaptureSheet({ open, onClose, categories, tags, onApply }: VoiceCaptureSheetProps) {
  const t = useTranslations();
  const intensity = useMotionIntensity();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [amountExpression, setAmountExpression] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [kind, setKind] = useState<VoiceCaptureKind | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);
  const [matchedCategory, setMatchedCategory] = useState<VoiceCategoryMatch | null>(null);
  const [matchedTags, setMatchedTags] = useState<VoiceTagMatch[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // El sheet se remonta por `key` en cada apertura (`CaptureFlow`), así que basta con
  // un flag por instancia para no auto-arrancar dos veces en re-renders.
  const startedRef = useRef(false);
  // Handlers de un reconocimiento ya cerrado no deben tocar el estado — sin esto, un
  // `onresult`/`onend` que llega tarde hace `setState` sobre un sheet cerrado/desmontado.
  const aliveRef = useRef(true);
  const supported = !!getSpeechRecognition();
  const { level, live: micLive } = useMicLevel(listening);

  /** Único punto de apagado del reconocimiento — se invoca desde los cuatro caminos de
   *  salida (cerrar sheet, desmontar, aplicar, toggle de parar) para que nunca quede un
   *  `SpeechRecognition` corriendo sin que el usuario lo sepa. */
  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    (recognition.abort ?? recognition.stop).call(recognition);
    recognitionRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar/desmontar la instancia (remontada por `key`)
  }, []);

  useEffect(() => {
    // Solo detiene el reconocimiento en curso — el estado (transcript,
    // campos) se reinicia remontando el componente (`key` en el padre),
    // no acá: evita el setState síncrono dentro del efecto.
    if (!open) stopRecognition();
  }, [open, stopRecognition]);

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    setErrorKey(null);
    setInterimTranscript("");
    const recognition = new Recognition();
    // Fijo en es-UY: `parseVoiceCapture` solo entiende español rioplatense
    // (ver el comentario de `parse-voice.ts`) — cambiarlo desalinearía el
    // reconocimiento del audio con lo que el parser puede interpretar.
    recognition.lang = "es-UY";
    recognition.continuous = false;
    // Transcripción en vivo (C9): el texto interino se muestra mientras se habla, pero
    // el parseo solo corre sobre el resultado final — evita re-parsear en cada palabra.
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (!aliveRef.current) return;
      const result = event.results[event.results.length - 1];
      const text = result?.[0]?.transcript ?? "";
      if (!result?.isFinal) {
        setInterimTranscript(text);
        return;
      }
      setInterimTranscript("");
      setTranscript(text);
      const parsed = parseVoiceCapture(text);
      if (parsed.amountExpression) setAmountExpression(parsed.amountExpression);
      if (parsed.payeeName) setPayeeName(parsed.payeeName);
      setKind(parsed.kind);
      setCurrencyCode(parsed.currencyCode);
      // Transferencia no tiene categoría — para el resto, filtrar por el
      // kind detectado (default gasto) evita matchear "sueldo" en un gasto.
      const candidateKind = parsed.kind === "income" ? "income" : "expense";
      setMatchedCategory(parsed.kind === "transfer" ? null : matchVoiceCategory(parsed.payeeName, categories.filter((c) => c.kind === candidateKind)));
      setMatchedTags(matchVoiceTags(text, tags));
    };
    recognition.onerror = (event) => {
      if (!aliveRef.current) return;
      setErrorKey(ERROR_MESSAGE_KEY[event.error ?? ""] ?? "capture.voice_sheet.errors.other");
      setListening(false);
    };
    recognition.onend = () => {
      if (!aliveRef.current) return;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // `InvalidStateError` u otro throw síncrono — mismo tratamiento que
      // un `onerror` asíncrono, para no dejar el botón "colgado".
      setErrorKey("capture.voice_sheet.errors.other");
    }
  }, [categories, tags]);

  // Auto-arranque: tocar "Voz" en el keypad ya implica la intención de dictar, así que
  // el sheet abre directo escuchando en vez de pedir un segundo toque sobre el botón.
  useEffect(() => {
    if (open && supported && !startedRef.current) {
      startedRef.current = true;
      startListening();
    }
  }, [open, supported, startListening]);

  // "reduced" mantiene el anillo pero con amplitud atenuada, en vez de apagarlo entero
  // (eso lo hace "minimal", que ni siquiera monta este árbol).
  const amplitudeFactor = intensity === "reduced" ? 0.4 : 1;
  const ringLevel = useTransform(level, (v) => 1 + v * 0.6 * amplitudeFactor);
  const ringOpacity = useTransform(level, (v) => 0.35 * v * amplitudeFactor);

  return (
    <Sheet open={open} title={t("capture.voice_sheet.title")} onClose={onClose} height={360}>
      {!supported ? (
        <p className="t-body" style={{ color: "var(--text-secondary)" }}>
          {t("capture.voice_sheet.unsupported")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ position: "relative", alignSelf: "center", width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {listening && intensity !== "minimal" ? (
              micLive ? (
                // Amplitud real: un solo anillo cuya escala/opacidad siguen el RMS del mic.
                <motion.div
                  aria-hidden
                  style={{ position: "absolute", inset: 0, borderRadius: 999, background: "var(--critical)", scale: ringLevel, opacity: ringOpacity, pointerEvents: "none" }}
                />
              ) : (
                // Sin stream de amplitud (permiso denegado, sin soporte): pulso sintético
                // de dos anillos desfasados, solo para señalar "activo".
                <>
                  <motion.div
                    aria-hidden
                    style={{ position: "absolute", inset: 0, borderRadius: 999, background: "var(--critical)", pointerEvents: "none" }}
                    animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    aria-hidden
                    style={{ position: "absolute", inset: 0, borderRadius: 999, background: "var(--critical)", pointerEvents: "none" }}
                    animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  />
                </>
              )
            ) : null}
            <button
              type="button"
              onClick={() => (listening ? stopRecognition() : startListening())}
              aria-pressed={listening}
              aria-label={t(listening ? "capture.voice_sheet.stopListening" : "capture.voice_sheet.startListening")}
              style={{
                position: "relative",
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
          </div>
          <p className="t-body" style={{ textAlign: "center", color: errorKey ? "var(--critical)" : "var(--text-secondary)" }}>
            {listening ? interimTranscript || t("capture.voice_sheet.listening") : errorKey ? (t as (key: string) => string)(errorKey) : transcript || t("capture.voice_sheet.prompt")}
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
                {currencyCode ? (
                  <p className="t-label" style={{ color: "var(--text-muted)", margin: 0 }}>
                    {`${t("capture.voice_sheet.currencyLabel")}: ${currencyCode}`}
                  </p>
                ) : null}
                {matchedTags.length > 0 ? (
                  <p className="t-label" style={{ color: "var(--text-muted)", margin: 0 }}>
                    {`${t("capture.voice_sheet.tagsLabel")}: ${matchedTags.map((tg) => tg.tagName).join(", ")}`}
                  </p>
                ) : null}
              </div>
              <Button
                onClick={() => {
                  stopRecognition();
                  onApply({
                    amountExpression,
                    payeeName,
                    kind,
                    categoryId: matchedCategory?.categoryId ?? null,
                    currencyCode,
                    tagIds: matchedTags.map((tg) => tg.tagId),
                  });
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
