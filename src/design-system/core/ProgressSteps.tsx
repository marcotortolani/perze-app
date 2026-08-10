import type { CSSProperties } from "react";

export interface ProgressStepsProps {
  /** Paso actual, 1-indexado. */
  current: number;
  total: number;
  onSkip?: (() => void) | undefined;
  /** Requerido cuando `onSkip` está presente — lo resuelve el caller vía `useTranslations`. */
  skipLabel?: string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Barra de progreso de onboarding: segmentos de 3px, con "Saltear" siempre
 * disponible — `docs/03-prompts-wireframes.md` § A4-A9.
 *
 * El segmento inactivo NO usa `--surface-3`: contra `--page` (el fondo de
 * `ScreenShell`, casi negro puro en oscuro) da ~1,3:1 de contraste — el
 * mismo defecto de fondo que la auditoría visual documenta para la
 * selección por superficie (chips, segmentados), acá aplicado a un track
 * de progreso. En vez de esperar el token de selección nuevo (que resuelve
 * un problema distinto: superficie contra superficie, no superficie
 * contra página), acá alcanza con mezclar `--text-primary` a baja opacidad
 * — dado que el track es un elemento neutro, no un dato ni una elección,
 * nunca debe competir con el violeta de marca ni con la paleta de datos.
 *
 * `flex: 1` en la raíz (no solo en el track interno) es la otra mitad del
 * arreglo: todo caller pone este componente como segundo hijo de un
 * header `display:flex` sin darle `flex:1` a ÉL, solo al `gap`. Sin un
 * ancho real que ocupar, el track interno (`flex:1` relativo a ESTA
 * raíz) no tenía contra qué crecer y colapsaba a 0px — invisible
 * independientemente del color. `style` puede seguir pisando esto si
 * algún caller necesita un ancho fijo.
 */
export function ProgressSteps({ current, total, onSkip, skipLabel, style }: ProgressStepsProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, ...style }}>
      <div style={{ flex: 1, display: "flex", gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: i < current ? "var(--primary-fill)" : "color-mix(in srgb, var(--text-primary) 35%, transparent)",
              transition: "background var(--duration-base) var(--ease-spring-soft)",
            }}
          />
        ))}
      </div>
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          style={{ background: "none", border: 0, cursor: "pointer", padding: "4px 0", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}
        >
          {skipLabel}
        </button>
      ) : null}
    </div>
  );
}
