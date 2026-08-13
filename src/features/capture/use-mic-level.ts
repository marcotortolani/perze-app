"use client";

import { useEffect, useState } from "react";
import { useMotionValue, type MotionValue } from "motion/react";
import { useMotionIntensity } from "@/components/motion/use-motion-intensity";

/**
 * RMS normalizado (0..1) de un buffer de tiempo de `AnalyserNode.getByteTimeDomainData`.
 * Función pura, separada del hook, para poder testearla sin `AudioContext`.
 */
export function rmsFromTimeDomain(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    // Cada byte es 0..255 con 128 = silencio; se normaliza a -1..1.
    const normalized = (data[i]! - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  return Math.min(1, Math.max(0, rms));
}

export interface UseMicLevelResult {
  /** Nivel 0..1 suavizado. Con `live: false` queda fijo en 0 — el pulso sintético del
   *  anillo se anima aparte, no depende de este valor. */
  level: MotionValue<number>;
  /** true si el stream de audio está realmente abierto y midiendo. */
  live: boolean;
}

/**
 * Segundo stream de audio, en paralelo al reconocimiento de voz, solo para medir
 * amplitud y animar el anillo — nunca condiciona si el dictado funciona. Si
 * `getUserMedia` no existe o el permiso se niega, `live` queda en `false` y el
 * llamador cae a un pulso sintético.
 *
 * `active` gobierna todo el ciclo de vida: al pasar a `false` (o al desmontar) se
 * cierra el analyser, se paran los tracks del stream y se cierra el `AudioContext`
 * en un único lugar — dejar esto vivo es lo que enciende el indicador de mic del
 * navegador sin que el usuario lo sepa.
 */
export function useMicLevel(active: boolean): UseMicLevelResult {
  const level = useMotionValue(0);
  const [live, setLive] = useState(false);
  const intensity = useMotionIntensity();
  // "Mínima" no dibuja el anillo — no vale la pena pedir el permiso de mic solo para eso.
  const wantsLevel = active && intensity !== "minimal";

  useEffect(() => {
    // `live` ya nace en `false` y el cleanup de abajo lo vuelve a poner en `false` al
    // desactivarse — nunca hace falta un `setLive(false)` síncrono acá en el cuerpo.
    if (!wantsLevel) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let rafId: number | null = null;

    const teardown = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      analyser?.disconnect();
      analyser = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      void audioContext?.close();
      audioContext = null;
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) {
          setLive(false);
          teardown();
          return;
        }
        audioContext = new Ctx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        audioContext.createMediaStreamSource(mediaStream).connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);
        setLive(true);

        const tick = () => {
          if (cancelled || !analyser) return;
          analyser.getByteTimeDomainData(buffer);
          level.set(rmsFromTimeDomain(buffer));
          rafId = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      });

    return () => {
      cancelled = true;
      setLive(false);
      level.set(0);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `level` es un MotionValue estable
  }, [wantsLevel]);

  return { level, live };
}
