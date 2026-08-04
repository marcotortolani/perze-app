import { useId, type CSSProperties, type ReactNode } from "react";
import { Overlay } from "./Overlay";

export interface SheetProps {
  open?: boolean | undefined;
  title?: string | undefined;
  children?: ReactNode | undefined;
  /** Tap en el backdrop / Escape / cierre programático. */
  onClose?: (() => void) | undefined;
  height?: number | string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Bottom sheet: superficie 2, radio 28 arriba, agarradera, scrim al 60%.
 * Sheets y el FAB son los únicos elementos con sombra.
 *
 * D3 — antes esto no tenía portal (se posicionaba `absolute` contra el
 * ancestro más cercano, no `fixed` contra el viewport), ni trampa de
 * foco, ni cierre con Escape, ni bloqueo de scroll del body: cuatro cosas
 * que `Overlay` ya resolvía para el buscador y acá se reimplementaban mal
 * (de hecho, no se reimplementaban: no estaban). Ahora `Sheet` es un
 * wrapper fino sobre `Overlay` (`variant="sheet"`) — mismo contrato de
 * props hacia afuera, la mecánica de diálogo vive en un solo lugar.
 */
export function Sheet({ open = true, title, children, onClose, height = "auto", style }: SheetProps) {
  const titleId = useId();
  return (
    <Overlay open={open} onClose={onClose ?? (() => {})} variant="sheet" height={height} style={style} labelledBy={title ? titleId : undefined}>
      {/* Agarradera + título: fuera del área que scrollea, ver el comentario
          de `overflow` en `Overlay` — quedan fijos arriba sea cual sea el
          contenido de abajo. */}
      <div style={{ flexShrink: 0, width: 36, height: 4, borderRadius: 999, background: "var(--border)", margin: "0 auto 14px" }} />
      {title ? (
        <h2
          id={titleId}
          style={{
            flexShrink: 0,
            margin: "0 0 16px",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-title-size)",
            lineHeight: "var(--text-title-line)",
            fontWeight: 600,
            letterSpacing: "var(--text-title-track)",
          }}
        >
          {title}
        </h2>
      ) : null}
      {/* Único contenedor que scrollea. `minHeight: 0` es necesario para que
          un hijo flex en columna respete `overflowY: auto` en vez de
          desbordar al padre (mismo motivo que `.app-shell-column`, ver
          `globals.css`). Nunca overflow-X: un hijo de ancho fijo (una
          grilla angosta) no debería abrir scroll horizontal acá — lo que
          legítimamente lo necesita ya declara su propio `overflowX`. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>{children}</div>
    </Overlay>
  );
}
