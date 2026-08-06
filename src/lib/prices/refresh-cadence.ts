/**
 * D50 — dos cadencias, una sola fuente: adentro de una pantalla de
 * inversiones el precio importa más (el usuario lo está mirando/operando
 * con él), así que se refresca seguido; en cualquier otra parte de la app
 * alcanza con que no se quede desactualizado por horas, sin gastar red de
 * más por algo que nadie está viendo.
 */
export const FOREGROUND_REFRESH_MS = 5 * 60_000;
export const BACKGROUND_REFRESH_MS = 20 * 60_000;
