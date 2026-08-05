"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { dayRange, monthRange, scopeFromParams, type CalendarScope, type DateRange } from "@/features/movements/calendar-scope";

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
   */
  const openCalendar = useCallback(() => {
    push((params) => {
      params.set("view", "calendar");
      params.delete("tx");
      applyRange(params, monthRange(scope.month));
    });
  }, [push, scope.month]);

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
