"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { dayRange, monthFromParams, monthRange, scopeFromParams, type CalendarScope, type DateRange } from "@/features/movements/calendar-scope";

/**
 * La vista de calendario de `/transactions`, leída y escrita desde la URL.
 *
 * Existe para que las DOS puntas que la necesitan —la lista, que dibuja el
 * chip y el alcance, y `page.tsx`, que decide en qué columna va la grilla—
 * hablen exactamente el mismo idioma sin pasarse nada por props. Las dos
 * derivan el alcance del mismo lugar (`from`/`to`), así que no existe el estado
 * intermedio que podría desincronizarlas.
 *
 * **Toda navegación es `push`, nunca `replace`.** Abrir el calendario, elegir
 * un día y cambiar de mes son pasos que el botón atrás —el del navegador y el
 * de Android en la PWA— tiene que poder deshacer, igual que abrir el detalle
 * de un movimiento. `{ scroll: false }` para que la lista no salte al tope.
 *
 * Y siempre se conservan los demás params: acá se llega con filtros puestos
 * desde el home (`?kind=`, `?pending=`) y desde el buscador (`?category=`,
 * `?payee=`). Armar la URL de cero los borraría.
 */
export interface CalendarView {
  /** `true` si la vista de calendario está activa. */
  open: boolean;
  /** Mes visible y día elegido, derivados de `from`/`to`. */
  scope: CalendarScope;
  openCalendar: () => void;
  closeCalendar: () => void;
  /** `null` deselecciona el día y vuelve al mes entero. */
  selectDay: (day: string | null) => void;
  changeMonth: (month: string) => void;
}

export function useCalendarView(): CalendarView {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const open = searchParams.get("view") === "calendar";

  // `useMemo` con `searchParams`: `new Date()` en cada render daría una
  // referencia nueva, pero el alcance solo depende de los params salvo cuando
  // NO hay `from`, y ahí lo único que se usa del reloj es el mes corriente.
  const scope = useMemo(() => scopeFromParams(fromParam, toParam, new Date()), [fromParam, toParam]);

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      const query = next.toString();
      router.push(query ? `/transactions?${query}` : "/transactions", { scroll: false });
    },
    [router, searchParams]
  );

  const applyRange = (params: URLSearchParams, range: DateRange) => {
    params.set("from", range.from);
    params.set("to", range.to);
  };

  /**
   * Abrir el calendario DESELECCIONA el movimiento abierto.
   *
   * La segunda columna del split tiene un solo ocupante y gana la última
   * acción explícita del usuario. Antes el detalle ganaba siempre: con un
   * movimiento abierto, tocar el chip no mostraba nada —el calendario
   * quedaba tapado— y no había forma de salir, porque el chip ya estaba
   * "encendido" y volver a tocarlo lo apagaba sin devolver el calendario.
   *
   * Esto no rompe el camino inverso, que es el que motivaba la regla vieja:
   * llegar a un movimiento DESDE un día del calendario sigue mostrando el
   * detalle, y el rango del día sigue filtrando la lista de la izquierda.
   *
   * **Arranca SIEMPRE en el mes real de hoy, nunca en `scope.month`.** El
   * calendario es un explorador mes a mes libre — la gracia de tocar
   * "Calendario" es poder recorrer cualquier mes sin quedar atado a nada.
   * Si tomara `scope.month` (derivado de `from`/`to`), heredaría el período
   * que haya dejado aplicado el historial: `closeHistory()` deja `from`/`to`
   * puestos a propósito (el chip de período tiene que sobrevivir a cerrar el
   * panel), así que abrir el calendario después de haber elegido "agosto"
   * en el historial abría el calendario YA acotado a agosto — el mismo
   * `from`/`to` que el chip mostraba, pero ahora gobernando el calendario en
   * vez de solo la lista. Arrancar siempre en el mes de hoy es además el
   * mismo comportamiento que ya tenía cualquier apertura de calendario antes
   * de que existiera el historial: `closeCalendar()` borra `from`/`to`, así
   * que reabrirlo siempre caía en el mes real por la misma vía.
   */
  const openCalendar = useCallback(() => {
    push((params) => {
      params.set("view", "calendar");
      params.delete("tx");
      applyRange(params, monthRange(scopeFromParams(null, null, new Date()).month));
    });
  }, [push]);

  // Cerrar borra también el rango: el calendario ES el selector de fecha
  // mientras está abierto, así que al salir la lista vuelve a mandar con su
  // preset, no con el mes que quedó puesto.
  const closeCalendar = useCallback(() => {
    push((params) => {
      params.delete("view");
      params.delete("from");
      params.delete("to");
    });
  }, [push]);

  const selectDay = useCallback(
    (day: string | null) => {
      push((params) => applyRange(params, day ? dayRange(day) : monthRange(scope.month)));
    },
    [push, scope.month]
  );

  // Cambiar de mes deselecciona el día por construcción: el rango pasa a ser
  // el del mes entero, y `scopeFromParams` lee eso como "sin día elegido".
  const changeMonth = useCallback(
    (month: string) => {
      push((params) => applyRange(params, monthRange(month)));
    },
    [push]
  );

  return { open, scope, openCalendar, closeCalendar, selectDay, changeMonth };
}

/**
 * La vista de historial de `/transactions` — mismo contrato de URL que
 * `useCalendarView` (un solo param `view`, que por eso solo puede valer
 * `"calendar"` O `"history"` nunca los dos), pero con una diferencia
 * deliberada: acá cerrar el panel NO borra `from`/`to`.
 *
 * El calendario ES el selector de fecha mientras está abierto (cerrarlo sin
 * limpiar el rango dejaría un mes "fantasma" gobernando la lista sin
 * ninguna UI que lo explique). El historial es distinto: elegir un mes es
 * una ACCIÓN — "aplicá este período a mis filtros" — no un modo de
 * exploración transitorio. Cerrar el panel es solo dejar de mirar la lista
 * de meses; el período elegido se queda aplicado, con su propio chip
 * removible en la lista (ver `TransactionsListContent`).
 */
export interface HistoryView {
  /** `true` si el panel de historial está activo. */
  open: boolean;
  /**
   * El mes que `from`/`to` representan, SOLO si son exactamente el rango de
   * un mes calendario completo (`monthFromParams`) — un día suelto o un
   * período arbitrario (el deep link del home) no cuentan como "mes
   * elegido" acá, aunque compartan el mismo par de params.
   */
  selectedMonth: string | null;
  openHistory: () => void;
  closeHistory: () => void;
  selectMonth: (month: string) => void;
}

export function useHistoryView(): HistoryView {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const open = searchParams.get("view") === "history";
  const selectedMonth = useMemo(() => monthFromParams(fromParam, toParam), [fromParam, toParam]);

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      const query = next.toString();
      router.push(query ? `/transactions?${query}` : "/transactions", { scroll: false });
    },
    [router, searchParams]
  );

  // A diferencia de `openCalendar`, NO toca `from`/`to`: abrir el panel es
  // solo elegir QUÉ se ve en la columna derecha, no un alcance nuevo. Sigue
  // deseleccionando el movimiento abierto por la misma razón que el
  // calendario — la columna tiene un solo ocupante.
  const openHistory = useCallback(() => {
    push((params) => {
      params.set("view", "history");
      params.delete("tx");
    });
  }, [push]);

  // Solo borra `view` — el período elegido (si lo hay) se queda aplicado a
  // la lista. Ver la nota del tipo.
  const closeHistory = useCallback(() => {
    push((params) => params.delete("view"));
  }, [push]);

  const selectMonth = useCallback(
    (month: string) => {
      push((params) => {
        params.set("view", "history");
        const range = monthRange(month);
        params.set("from", range.from);
        params.set("to", range.to);
      });
    },
    [push]
  );

  return { open, selectedMonth, openHistory, closeHistory, selectMonth };
}
