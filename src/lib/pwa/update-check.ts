/**
 * Cada cuánto, como mucho, se le vuelve a preguntar al servidor si hay una
 * versión nueva del service worker.
 *
 * Dos horas y no dos minutos: encontrar la actualización rápido no es un
 * objetivo del producto. Quien necesite la versión nueva ya mismo cierra la
 * app y la vuelve a abrir —una carga completa dispara el chequeo del
 * navegador por su cuenta— y ese es un camino que el usuario ya conoce.
 * Chequear seguido, en cambio, tiene costo real: si aparece una versión
 * nueva, instalarla baja el precache entero (~6,5 MB), y eso con datos
 * móviles no es gratis.
 */
export const UPDATE_CHECK_MIN_INTERVAL_MS = 2 * 60 * 60_000;

export interface UpdateCheckInput {
  now: number;
  /** `null` = todavía no se chequeó en este documento. */
  lastCheckAt: number | null;
  online: boolean;
}

/**
 * Si corresponde volver a chequear actualizaciones del service worker.
 *
 * Sin red devuelve `false` siempre: un `registration.update()` offline no
 * puede hacer nada más que fallar, y desde que el fallo de registro se
 * loguea (`service-worker-register.tsx`) ese ruido tapa errores reales.
 *
 * Vive acá y no adentro del componente para poder testear la decisión sin
 * montar React ni simular eventos del DOM.
 */
export function shouldCheckForUpdate({ now, lastCheckAt, online }: UpdateCheckInput): boolean {
  if (!online) return false;
  if (lastCheckAt === null) return true;
  return now - lastCheckAt >= UPDATE_CHECK_MIN_INTERVAL_MS;
}
