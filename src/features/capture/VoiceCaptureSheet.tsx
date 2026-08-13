"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Button, Icon, Sheet } from "@/design-system";
import { useMotionIntensity } from "@/components/motion/use-motion-intensity";
import { matchVoiceCategory, matchVoiceTags, parseVoiceCapture, type VoiceCaptureKind, type VoiceCategoryMatch, type VoiceTagMatch } from "./parse-voice";

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
  /** Moneda base del household — desambigua un "pesos" dicho sin calificar (ver `parse-voice.ts`). */
  localCurrencyCode?: string | null;
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
export function VoiceCaptureSheet({ open, onClose, categories, tags, onApply, localCurrencyCode = null }: VoiceCaptureSheetProps) {
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
  // Handlers de un reconocimiento ya cerrado no deben tocar el estado — sin esto, un
  // `onresult`/`onend` que llega tarde hace `setState` sobre un sheet cerrado/desmontado.
  const aliveRef = useRef(true);
  const supported = !!getSpeechRecognition();

  /** Único punto de apagado del reconocimiento — se invoca desde los cinco caminos de
   *  salida (cerrar sheet, desmontar, aplicar, toggle de parar, pantalla oculta) para que
   *  nunca quede un `SpeechRecognition` corriendo sin que el usuario lo sepa. Se prefiere
   *  `stop()` a `abort()`: en iOS/WebKit, `abort()` corta de golpe sin pasar por el cierre
   *  normal del motor de reconocimiento, y es un patrón reportado de que el indicador de
   *  micrófono del sistema se quede prendido después de cerrar — `stop()` deja terminar el
   *  reconocimiento en curso y libera el micrófono de forma más confiable. Los handlers ya
   *  están en `null` antes de llamar a cualquiera de los dos, así que el resultado final que
   *  `stop()` pueda disparar no vuelve a tocar el estado. Puede tirar sobre un reconocimiento
   *  ya terminado en algunos motores — el propio caller (p. ej. "Usar esto") no puede
   *  depender de que esto nunca lance. */
  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      // Ya terminado o nunca arrancó de verdad — no hay nada más que limpiar.
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar/desmontar
  }, []);

  // Red de seguridad: cambiar de pantalla, mandar la app a segundo plano o bloquear el
  // dispositivo con el sheet todavía escuchando no debe dejar el micrófono prendido. Los
  // cierres normales (botón, backdrop, Escape, drag) ya pasan por el efecto de `open` de
  // abajo — esto cubre las salidas que no tocan esa prop.
  useEffect(() => {
    function stopIfHidden() {
      if (document.hidden) stopRecognition();
    }
    document.addEventListener("visibilitychange", stopIfHidden);
    window.addEventListener("pagehide", stopRecognition);
    return () => {
      document.removeEventListener("visibilitychange", stopIfHidden);
      window.removeEventListener("pagehide", stopRecognition);
    };
  }, [stopRecognition]);

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    // Nunca dos instancias vivas a la vez — pisar `recognitionRef` sin abortar la anterior
    // dejaba un recognizer filtrado (indicador de mic prendido en WebKit).
    stopRecognition();
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
      const parsed = parseVoiceCapture(text, localCurrencyCode);
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
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      if (!aliveRef.current) return;
      // Instancia terminada — sacarla del ref además de apagar `listening`, si no el
      // próximo `startListening()` la pisa sin haberla abortado nunca.
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // `InvalidStateError` u otro throw síncrono — mismo tratamiento que
      // un `onerror` asíncrono, para no dejar el botón "colgado" ni una
      // instancia a medio construir en el ref.
      recognitionRef.current = null;
      setListening(false);
      setErrorKey("capture.voice_sheet.errors.other");
    }
  }, [categories, tags, stopRecognition, localCurrencyCode]);

  // El sheet ya no se remonta por `key` — este efecto es la única puerta de
  // entrada/salida: al abrir, resetea todo lo interpretado de la vez anterior y arranca
  // escuchando (tocar "Voz" ya implica la intención de dictar); al cerrar, apaga el
  // reconocimiento. Sin esto, cerrar y reabrir reusaría el estado de la sesión anterior.
  useEffect(() => {
    if (!open) {
      // Sincronización genuina con el prop `open`, no derivable del render — es
      // justo la transición open→closed la que tiene que apagar el micrófono.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      stopRecognition();
      return;
    }
    setTranscript("");
    setInterimTranscript("");
    setAmountExpression("");
    setPayeeName("");
    setKind(null);
    setCurrencyCode(null);
    setMatchedCategory(null);
    setMatchedTags([]);
    setErrorKey(null);
    if (supported) startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr al cambiar `open`, no en cada re-render de `startListening`
  }, [open]);

  // "reduced" mantiene el pulso pero con amplitud atenuada, en vez de apagarlo entero (eso
  // lo hace "minimal", que ni siquiera monta este árbol).
  const amplitudeFactor = intensity === "reduced" ? 0.4 : 1;

  return (
    <Sheet open={open} title={t("capture.voice_sheet.title")} onClose={onClose}>
      {!supported ? (
        <p className="t-body" style={{ color: "var(--text-secondary)" }}>
          {t("capture.voice_sheet.unsupported")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
          {/* 120×120: la caja del anillo (72 × escala máxima 1.6 ≈ 115px) queda reservada
              adentro del wrapper, así el halo nunca sangra fuera de él — ni se recorta
              arriba (primer hijo del scroller) ni suma alto scrolleable de más abajo. */}
          <div style={{ position: "relative", alignSelf: "center", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {listening && intensity !== "minimal" ? (
              <>
                <motion.div
                  aria-hidden
                  style={{ position: "absolute", inset: 24, borderRadius: 999, background: "var(--critical)", pointerEvents: "none" }}
                  animate={{ scale: [1, 1 + 0.6 * amplitudeFactor], opacity: [0.35 * amplitudeFactor, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  aria-hidden
                  style={{ position: "absolute", inset: 24, borderRadius: 999, background: "var(--critical)", pointerEvents: "none" }}
                  animate={{ scale: [1, 1 + 0.4 * amplitudeFactor], opacity: [0.3 * amplitudeFactor, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                />
              </>
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
