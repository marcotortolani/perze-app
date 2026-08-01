import TransactionDetailDefault from "../default";

/**
 * `/transactions/calendar` es una ruta estática hermana de `[id]`, no un
 * detalle. Sin este archivo, el interceptor `@detail/(.)[id]` reclama el
 * segmento "calendar" como si fuera un id de movimiento en cualquier
 * navegación blanda (`router.push`/`Link`) — `useTransaction("calendar")`
 * termina consultando un movimiento que no existe, lo que antes rompía
 * con "Query data cannot be undefined" y, incluso arreglado eso, hubiera
 * mostrado el sheet de detalle "no encontrado" tapando el calendario.
 * Este archivo, con más especificidad que el interceptor dinámico, hace
 * que Next lo prefiera para este segmento exacto.
 */
export default function TransactionsCalendarDetailSlot() {
  return <TransactionDetailDefault />;
}
