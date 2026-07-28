"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Sheet } from "@/design-system";
import { parseVoiceCapture } from "./parse-voice";

export interface VoiceCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  onApply: (result: { amountExpression: string; payeeName: string }) => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** C9 — captura por voz. Todo lo interpretado queda editable antes de confirmar; degrada limpio si el navegador no la soporta. */
export function VoiceCaptureSheet({ open, onClose, onApply }: VoiceCaptureSheetProps) {
  const t = useTranslations();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [amountExpression, setAmountExpression] = useState("");
  const [payeeName, setPayeeName] = useState("");
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
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
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
          <p className="t-body" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
            {listening ? t("capture.voice_sheet.listening") : transcript || t("capture.voice_sheet.prompt")}
          </p>
          {transcript ? (
            <>
              <p className="t-label" style={{ color: "var(--text-muted)" }}>
                {t("capture.voice_sheet.summary", {
                  amount: amountExpression || t("capture.voice_sheet.empty"),
                  payee: payeeName || t("capture.voice_sheet.empty"),
                })}
              </p>
              <Button
                onClick={() => {
                  onApply({ amountExpression, payeeName });
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
