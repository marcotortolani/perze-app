# Changelog

Todos los cambios notables de este proyecto están documentados en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [0.29.21] — 2026-08-06

### Corregido — el bloqueo por PIN/biométrico no se activaba al pasar a background

Reporte del usuario: con el PIN o el biométrico activados, minimizar la PWA, pasar a otra
app y volver mostraba el contenido directo, sin pedir desbloqueo — solo cerrar la PWA por
completo (matar el proceso) re-armaba el gate.

Causa: `PinGate` guardaba el estado "desbloqueado en esta sesión" en `sessionStorage`, que
sobrevive minimizar/cambiar de app — solo se pierde al cerrar la pestaña/proceso de verdad.
Y aunque hubiera existido una forma de invalidarlo, minimizar no dispara un remount de
React, así que nada iba a releerlo de todos modos. Se agrega un listener de
`visibilitychange`: apenas `document.visibilityState` pasa a `"hidden"` (la señal real de
"salió de primer plano" en una PWA — a diferencia de un `blur` de ventana, que dispara con
cualquier cambio de foco sin salir de la app), se limpia el desbloqueo de la sesión. Al
volver a mostrarse, el gate ya está re-armado.

De paso se corrige un bug latente relacionado: `PinGate` y `usePinUnlocked()` (usado por
`AccountPickerSheet`/`PayCardSheet` para ocultar saldos pre-auth) cada uno mantenía su
propio `useState(readSessionUnlocked)` — dos copias del mismo booleano, sin suscripción
entre sí. Aunque el `visibilitychange` de `PinGate` limpiara `sessionStorage`, la copia de
`usePinUnlocked()` en otro componente ya montado no se habría enterado hasta su próximo mount.
Ahora las dos leen de un store de Zustand compartido (sin `persist`: `sessionStorage` sigue
siendo la persistencia real; el store es solo la capa reactiva), así que un cambio en
cualquiera de los dos lugares se ve en el otro al instante.

## [0.29.20] — 2026-08-06

### Corregido — el mensaje de "no coinciden" quedaba pegado al reingresar el PIN

Reporte del usuario: al activar el bloqueo por PIN (Ajustes → Seguridad), si la confirmación
no coincidía con el PIN elegido, el mensaje de error se mantenía en pantalla durante todo el
reintento — daba la sensación de que algo seguía mal aunque el usuario ya estuviera tipeando
de nuevo desde cero. `handleKey()` en `src/app/(app)/more/security/page.tsx` solo limpiaba
`mismatch` en la rama de `backspace`; al tipear un dígito nuevo después de un error, el
mensaje quedaba visible hasta completar los 6 dígitos otra vez. Ahora se limpia apenas se
toca cualquier tecla, dígito o backspace.

## [0.29.19] — 2026-08-06

### Corregido — el changelog público se veía cortado a mitad de frase

Reporte del usuario: algunas entradas de "Novedades" (Más → Acerca de) se veían truncadas
dentro de la app. `CHANGELOG-PUBLIC.md` no tenía nada faltante — la propia regla del
archivo permite "dos líneas como máximo" por ítem cuando hace falta, y varias entradas ya
usaban esa segunda línea envuelta (indentada, sin el guion inicial (`-`), convención
estándar de Markdown para continuar un ítem de lista).

`parsePublicChangelog()` (`src/lib/changelog/parse-public-changelog.ts`) es un parser de
línea, no de Markdown genérico, y su regex de ítems (`/^-\s+(.+)$/`) solo reconocía la
primera línea de cada bullet. La segunda línea no matcheaba ningún patrón del loop (no es
versión, no es heading, no arranca con el guion (`-`)) y cayó siempre en el `continue` genérico —
se perdía en silencio, así que el texto se veía cortado justo donde envolvía la línea.
Ahora una línea no vacía que no matchea nada, con un grupo de ítems activo, se une con un
espacio al último ítem — no es un parser de Markdown completo (sigue sin soportar
sub-listas ni otra sintaxis), pero cubre exactamente el caso que la propia guía de estilo
del archivo declara como válido.

## [0.29.18] — 2026-08-06

### Agregado — toggle "moneda original / moneda base" en el detalle de instrumento (I4)

Pedido del usuario: ver un CEDEAR en pesos argentinos (su moneda de cotización) con la
opción de pasarlo a dólares (la base del household), igual que ya existía en el overview
del portfolio (D34) pero ahí era por-instrumento-en-cartera, no dentro del detalle de uno
en particular.

Mismo mecanismo que `OverviewContent`: `fxRepo.resolve()` una sola vez para el par
`instrument.currencyCode → household.baseCurrency` (acá acotado a un instrumento, no a la
lista de monedas en cartera), `convert()` sobre el valor/P&L/precio promedio/precio actual,
y `needs_fx` respetado — sin cotización, se muestra "pendiente de cotizar", nunca un
número inventado. El toggle (`SegmentedControl`) solo se dibuja cuando la moneda del
instrumento difiere de la base del household; si coinciden, sería puro ruido.

## [0.29.17] — 2026-08-06

### Agregado — "Instrumentos" reemplaza a "Estado de los precios"; fluctuación histórica en I4

Pedido del usuario: "estado de los precios" no comunicaba nada útil — los precios siempre son
los de mercado, y el ajuste manual (I12) ya se resuelve desde ahí mismo. Se reemplaza por
"Instrumentos" (`/investments/instruments`, antes `/investments/prices`, que queda como
`redirect` de compatibilidad — CLAUDE.md § convención de rutas, punto 5), con dos secciones:
"En tu portfolio" (lo que ya se compró — obligatorio, son los precios que de todas formas hay
que mantener actualizados) y "En seguimiento" (instrumentos sin posición que el household
agregó solo para hacerles seguimiento). Cada fila ahora navega al detalle del instrumento
(`positions/[instrumentId]`, I4) — antes solo se llegaba ahí desde una posición con operaciones
cargadas, así que un instrumento en seguimiento puro no tenía forma de abrir su detalle.

El botón de actualizar precio de cada fila vive en el `right` de `ListRow` (no en `value`) con
`stopPropagation()` — con la fila ahora clickeable, ponerlo en `value` habría anidado un
`<button>` dentro del `<button>` que `ListRow` arma cuando `onClick` está presente sin `right`.

"Agregar instrumento" se saca de `OverviewContent` (el overview del portfolio) y queda solo
en "Instrumentos" — la navegación pasa a ser mi portfolio → Instrumentos → Agregar instrumento,
como pidió el usuario.

`InstrumentDetailContent` (I4) suma un gráfico de fluctuación con selector de rango (semana /
mes / 6 meses / año — `PRICE_HISTORY_RANGES`, `sinceIsoForRange()`) sobre `price_snapshots`
(nuevo `priceSnapshotsRepo.historyFor()` / `usePriceHistory()`). **Decisión explícita, no un
recorte silencioso**: no hay rango "día". `price_snapshots` guarda un cierre por instrumento
por día (lo escribe el cron `daily-price-sync`) — no hay granularidad intradía, así que un
gráfico de "hoy" mostraría como mucho dos puntos, exactamente lo que CLAUDE.md § "Mínimos de
historial" dice que no hay que hacer ("un gráfico con dos puntos enseña una tendencia que no
existe"). Además `SegmentedControl` tiene un tope duro de 4 opciones en su propio contrato
("más de 4 es un Sheet"), y 5 rangos lo hubiera violado. La variación del día se sigue
mostrando — como texto ("↑ 2.3% hoy") junto al precio actual, calculada entre los dos cierres
más recientes, no como gráfico. Mismo criterio de mínimos para cualquier rango: con menos de
`MIN_HISTORY_POINTS` (3) cierres reales, se muestra cuánto historial falta en vez del gráfico.

Nuevo botón "Eliminar de seguimiento" (ícono bookmark, `IconButton` en el header) en I4 — solo
visible cuando el instrumento es propio del household (no del catálogo global, Patrón C) y no
tiene posición, mismo criterio que ya tenía la hoja de edición de "Instrumentos". Reutiliza
`instrumentsRepo.deleteUnused()`, ya existente.

Namespace de i18n `pricesStatusPage` renombrado a `instrumentsListPage` en los tres idiomas.

## [0.29.16] — 2026-08-06

### Agregado — "Registrar operación" desde el detalle de instrumento (I4)

Antes la única forma de cargar una compra/venta era desde el listado de "mi portfolio" y
elegir el instrumento a mano en la hoja de `trades/new`, aunque ya se estuviera parado en el
detalle de ese mismo instrumento con su ticket, su moneda y su cotización a la vista.

`InstrumentDetailContent` suma un botón "Registrar operación" que navega a
`/investments/[portfolioId]/trades/new?instrumentId=<id>`. No se duplicó la pantalla de carga:
`trades/new/page.tsx` lee `?instrumentId=` con un `useEffect` (antes del `if (!household ||
!userId) return null`, porque es un hook y tiene que correr siempre) y llama al mismo
`handleSelectInstrument` que ya usa la hoja de selección manual — mismo camino, mismo
`priceSnapshotsRepo.refreshFromProvider()` para prellenar el precio de mercado. Un `useRef`
evita reaplicar el prefill si `instruments` todavía no cargó en el primer render o si el
usuario después cambia el instrumento a mano.

### Corregido — falso positivo de TypeScript en `family-invite-email.spec.ts`

`npx tsc --noEmit -p .` fallaba en `e2e/family-invite-email.spec.ts:47` con `Property
'inviteId' does not exist on type 'never'` — no relacionado con este cambio, preexistente
desde J3 (v0.29.x). Causa: `sendRequestBody` es un `let` de módulo cuya única reasignación
vive dentro del closure de `page.route(...)`; TypeScript no hace control-flow analysis a
través de ese límite de función, así que en el punto de uso lo sigue viendo con su tipo
inicial (`null`), y `?.` sobre un tipo ya reducido a `null` colapsa a `never`. Es un límite
conocido de TS con variables mutadas solo dentro de callbacks, no un bug del test en sí — se
resuelve con un cast explícito en el punto de lectura (`(sendRequestBody as {...} | null)?.`),
sin tocar el comportamiento del test.

## [0.29.15] — 2026-08-06

### Agregado — cache persistido de precios: nunca más "$ 0,00" al entrar al portfolio

A veces entrar a "mi portfolio" no llegaba a cargar/actualizar los valores de mercado a tiempo
(API lenta, sin red, timing) y esas posiciones se mostraban en `$ 0,00` — el fallback de `value =
price ? ... : 0n` cuando todavía no había ningún precio. Nuevo `useInstrumentPricesStore`
(Zustand + `persist`, localStorage) guarda el último precio conocido por instrumento, sobrevive
recargas y sesiones. Nuevo `useCachedLatestPrices()` envuelve `useLatestPrices()`: mientras la
consulta real (cache de `price_snapshots` o el refresh en vivo que ya se agregó en D34) no
resolvió, rellena con el último valor conocido — nunca al revés, un dato fresco siempre gana.

`OverviewContent`, `InstrumentDetailContent` y `/investments/prices` dejan de bloquear el render en
`pricesQuery.isLoading`: con el cache persistido ya hay algo real para mostrar de entrada, así que
esperar la consulta ya no tiene sentido — es exactamente el escenario que generaba el "$ 0,00".

## [0.29.14] — 2026-08-06

### Agregado — push notifications para invitaciones recibidas, nuevo miembro del hogar y nueva versión

Auditoría previa (D35): `recurring_reminders` ya mandaba push cuando se materializa un
recurrente — nada que construir ahí. Los otros tres pedidos solo tenían el camino de mail; el
push nunca existía porque los dos primeros no encajan en el modelo de `send-push`
(household-scoped, filtrado por `notification_preferences` de household+profile) — "te
invitaron" es ANTES de ser miembro de nada, y "nueva versión" no es de ningún hogar en particular.

`send-push` suma un segundo modo de destinatario: `profileIds` explícito sin `householdId`,
filtrado por la nueva `profile_notification_preferences` (una fila por perfil, sin household) en
vez de `notification_preferences`. Sin `profileIds` en ese modo es un broadcast a todo dispositivo
suscrito — reservado a `service_role` o a `profiles.is_app_admin`.

- **Invitación recibida** (`household_invite`): nuevo trigger `notify_invite_created()` en
  `household_invites` — busca si el mail de la invitación coincide con una cuenta ya existente
  (`auth.users`, consultado directo desde la función SQL) y le manda push. Sin cuenta todavía, el
  mail sigue siendo el único camino — nadie recibe un push sin haberse registrado antes.
- **Alguien se unió a tu hogar** (`household_joined`): `notify_invite_accepted()` (el trigger que
  ya mandaba el mail al owner/admin) suma una segunda llamada a `send-push` con los mismos
  destinatarios. Nueva columna `notification_preferences.household_joined`.
- **Nueva versión disponible** (`app_update`): sin disparador automático — encender un envío que
  sale solo con cada deploy es una decisión de producto que no se toma sola (mismo criterio que ya
  regía para el resto de `send-push`). Nuevo botón "Avisar sobre nueva versión" en el panel del
  operador, con confirmación explícita (es un broadcast, no se puede deshacer) — pega a un Route
  Handler propio (`/api/admin/notify-app-update`) que reenvía la sesión del operador a `send-push`,
  nunca `service_role` fuera de una Edge Function/cron.

`/more/notificaciones` suma los tres toggles nuevos (`householdJoined` junto a los household-scoped
existentes; `inviteReceived`/`appUpdates` en una sección aparte, por perfil).

## [0.29.13] — 2026-08-06

### Agregado — "Estado de precios" ahora es una lista de seguimiento editable

Antes esa pantalla solo listaba instrumentos con al menos una operación cargada. Ahora lista todo
el catálogo visible del household (Patrón C: global + propio) — un instrumento se puede querer
seguir de precio sin haber comprado nada todavía. "+" reusa el mismo buscador de I7 (no una
segunda forma de crear un instrumento), y un botón "Actualizar" en el header dispara el mismo
refresh en vivo que ya corría solo al entrar. Nuevo `instrumentsRepo.deleteUnused()` — solo se
ofrece eliminar un instrumento propio del household sin ninguna operación cargada; uno del
catálogo global o con historial no se puede borrar (la FK de `trades` lo rechazaría igual, la UI
ya lo filtra antes).

### Cambiado — el overview y el detalle de instrumento dejan de mostrar un badge de frescura por fila

`PositionRow` (overview) e `InstrumentDetailContent` (I4) mostraban "Actualizado"/"Manual" por
posición, sin reflejar nunca un precio en vivo (solo el cache de `price_snapshots`, que escribe el
cron diario). Ahora, al entrar a un portfolio, se piden en vivo las cotizaciones de todo lo que
está en cartera una sola vez — escritas directo en el cache compartido de `useLatestPrices`, así
que el detalle de un instrumento las ve sin volver a pedirlas — y la pantalla declara un único
"Valores de mercado, última actualización: {fecha} a las {hora}" en vez de un badge por fila. Nuevo
`formatTimeOfDay()` (`i18n/formatting.ts`) para la hora, derivada del locale vía `Intl` como el
resto de las fechas — no hay ajuste de 12h/24h en Ajustes → Formato todavía. El detalle de
instrumento sin proveedor (FCI, plazo fijo) conserva un link simple "Cargar precio a mano", sin
badge ni botón de "actualizar" que reimplique volver a pedir el mercado.

**Diverge a propósito del diseño real** (I3/I4 en `bloque-i-inversiones.html` sí llevan un badge de
frescura condicional) — decisión de producto tomada en vivo con el usuario, documentada acá para
que quede explícita y no se "restaure" mirando el archivo de diseño viejo.

## [0.29.12] — 2026-08-06

### Agregado — histórico completo en el changelog público, desde el origen del proyecto

`CHANGELOG-PUBLIC.md` solo tenía las últimas versiones (desde 0.29.4). Se completa hacia atrás
hasta 0.1.0, agrupando ~90 versiones técnicas en ~20 entradas por hito user-facing real (mismo
criterio ya documentado en el archivo: nada de refactors, RLS, tipos o infraestructura) más una
sección narrativa "El principio" con el origen del proyecto (basada en `docs/00-producto.md`).

`parsePublicChangelog()` suma soporte para un heading `##` que no matchea el formato de versión — antes
esas líneas se perdían en silencio (ni error ni contenido, el parser las ignoraba sin más). Ahora
son una entrada `type: "narrative"` con párrafos de prosa real (líneas consecutivas sin blanco se
unen en un párrafo, como Markdown estándar), intercalada en su lugar cronológico. Un único heading
está en una lista de exclusión explícita (`"Cómo escribir una entrada acá"`, las reglas de edición
del archivo) para que nunca se renderice dentro de la app. `ChangelogContent.tsx` la muestra con el
mismo tratamiento visual que la cita de `/more/about` (borde izquierdo, cursiva) — prosa
subordinada al listado de versiones, no un dato de la app.

## [0.29.11] — 2026-08-06

### Agregado — changelog público dentro de la app (Más → Acerca de → Novedades)

`CHANGELOG.md` es técnico — pensado para quien programa Perze, no para quien la usa. Nuevo
`CHANGELOG-PUBLIC.md`: un documento paralelo, en español, con sus propias reglas de tono/formato/
longitud escritas adentro del archivo (qué entra, qué no, cómo describir un bug arreglado desde el
síntoma y no la causa técnica). `CLAUDE.md` suma la regla de mantenerlo actualizado junto con
`CHANGELOG.md` cuando el cambio es user-facing, y de no forzar una entrada cuando no lo es.

Nueva pantalla `/more/changelog` (Server Component: lee y parsea el `.md` en el servidor, sin
cliente de Supabase — `parsePublicChangelog()` es un parser de línea a medida del formato fijo del
archivo, no un parser de Markdown genérico) con un `ListRow` nuevo desde `/more/about`. El
contenido queda deliberadamente solo en español — traducir cada entrada a los tres idiomas en cada
versión es un costo de mantenimiento recurrente que no se paga para este proyecto; la UI alrededor
(título, estado vacío) sí pasa por `next-intl` como el resto de la app.

## [0.29.10] — 2026-08-06

### Corregido — la captura por voz no reconocía "ingresaron", moneda ni tags

Bug reportado en vivo: dictar "ingresaron 2500 dólares de sueldo" no cambiaba el toggle
gasto/ingreso, no detectaba USD, y no encontraba la categoría "Sueldo". La causa real era una
sola — `detectKind()` (`parse-voice.ts`) solo cubría 1ª persona singular ("ingresé"/"ingrese");
"ingresaron" (3ª plural, la forma real en que alguien narra "me depositaron el sueldo") no
matcheaba nada, así que `kind` quedaba `null`, y sin `kind` la categoría se buscaba entre las de
GASTO en vez de las de ingreso — "Sueldo" nunca iba a aparecer ahí. La cadena de wiring
kind→categoría ya estaba bien armada (`CaptureFlow.tsx` ya llamaba `setKind()` cuando `kind` venía
no-nulo); el fix es sumar más conjugaciones a las tres listas de verbos (gasto/ingreso/transferencia).

### Agregado — la captura por voz ahora reconoce moneda y tags

`parseVoiceCapture()` suma `currencyCode`: reconoce dólares/euros/reales y "pesos" calificado por
país (uruguayos/argentinos/mexicanos/chilenos) — "pesos" a secas se queda en `null` a propósito,
es ambiguo entre cuatro monedas y adivinar mal es peor que no tocar nada. Si hay UNA sola cuenta en
la moneda detectada, `CaptureFlow` la selecciona sola (el destino es obvio); con cero o más de una,
no adivina — el monto entra como "moneda original" sobre la cuenta ya elegida, convertido a su
moneda (mismo mecanismo que ya usa el prefill de "pagar tarjeta"), y el usuario cambia de cuenta a
mano si hacía falta otra.

Nuevo `matchVoiceTags()` — a diferencia de la categoría (una sola), los tags no son excluyentes:
busca cada tag del household en la frase completa (no solo en el comercio) y aplica todos los que
aparecen, p. ej. "es reembolsable y del cliente" aplica los dos tags a la vez.

### Arreglado — `SegmentedControl` quedaba más ancho que sus opciones dentro de una columna flex

Dentro de cualquier `display: flex; flex-direction: column` (el contenedor más común de la app),
`align-items: stretch` —el default del padre— estiraba el control al ancho completo aunque su
`display` interno fuera `inline-flex`, dejando el relleno de superficie con un hueco vacío del lado
derecho de las opciones. `alignSelf: "flex-start"` en la raíz lo saca de ese estiramiento sin
importar el padre — afecta a las ~13 pantallas que usan el componente, no solo al toggle de `/add`
donde se reportó.

## [0.29.9] — 2026-08-06

### Corregido — agregar una moneda sin tocar el rate la marcaba "Custom" y "Estándar" la borraba de la lista

Dos bugs relacionados en `/currencies`. Primero: `handleSaveOverride` era el único botón para
"agregar una moneda", así que aceptar la cotización sugerida tal cual (sin editarla) igual creaba
un override manual con `quoteKind: "custom"` — el chip decía "Custom" aunque nadie hubiera tocado
nada. Ahora, solo para el flujo de agregar (`addedResolution` presente) y solo si el rate final
coincide con el sugerido, se guarda una preferencia en vez de un override; editar el valor, o
reabrir una moneda ya existente, sigue guardando "custom" siempre — "Guardar override" ahí significa
exactamente eso.

Segundo, más grave: `currencies` (la lista visible) salía de `accounts ∪ overrides` — una moneda sin
cuenta propia (como EUR agregada solo para trackear su cotización) dependía por completo de tener un
override vigente para aparecer. Elegir "Estándar" en el picker de blue/CCL llama a
`clearManualOverride`, así que esa moneda desaparecía de la lista entera sin ningún rastro. Con
USD↔ARS y USD↔UYU no se notaba porque esas monedas ya tienen cuentas que las anclan por otro lado.
Nuevo `fxRepo.listPreferenceCurrencies()` — las monedas con una preferencia elegida (aunque nunca
hayan tenido override) también cuentan como ancladas, y `handleSelectQuoteKind` ya guardaba esa
preferencia junto con limpiar el override, así que el fix es sumar esta tercera fuente al `useMemo`
de `currencies`.

### Agregado — eliminar una moneda de la lista de tipos de cambio

Nuevo botón (solo si ninguna cuenta usa esa moneda — con una cuenta, la moneda sigue necesitando su
cotización a la base pase lo que pase) que borra las dos anclas juntas (`fxRepo.forgetCurrency()`):
el override si lo hay y la preferencia. Dejar cualquiera de las dos viva la resucitaría en la lista
sola.

## [0.29.8] — 2026-08-06

### Agregado — Permisos y visibilidad distingue cuentas homónimas por ícono, moneda y país

`/family` → Permisos y visibilidad listaba las cuentas solo por nombre: dos cuentas "Itaú" (una en
UYU, otra en USD, o una en cada país) eran indistinguibles sin abrir cada una a ciegas. Cada fila
ahora lleva el mismo ícono de tipo de cuenta con su color (`ACCOUNT_KIND_ICON`/`accountColorVar`,
ya usados en `/accounts`) más `tipo · moneda · país` en el `meta` — el mismo trío que
`AccountsListContent`, agregando la moneda explícita porque ahí la aporta el saldo formateado y acá
no hay saldo que mostrar.

## [0.29.7] — 2026-08-06

### Corregido — el total del portfolio sumaba montos de monedas distintas sin convertir

Bug de plata real, no solo UX: `totalValue` en el overview de un portfolio sumaba el `value` crudo
de cada posición **sin convertir a la moneda base**, aunque instrumentos de distinta moneda (un
CEDEAR en ARS junto a una acción en USD, con base UYU) dieran un bigint sin sentido. No se había
manifestado antes porque hasta 0.29.4 el buscador de instrumentos (I7) no traía nada fuera de la
moneda base con la que se probaba. `OverviewContent.tsx` ahora resuelve el rate de cada moneda en
cartera (`fxRepo.resolve`, mismo criterio que cualquier otra conversión de la app) antes de sumar,
y **excluye del total las posiciones sin cotización disponible** en vez de tratarlas como si
valieran 0 — declarado con `NeedsFxBanner`, igual que cualquier otro agregado (CLAUDE.md §
needs_fx).

### Agregado — moneda original vs moneda base en el overview del portfolio

Nuevo toggle (`SegmentedControl`) sobre la lista de posiciones — solo aparece si hay alguna en
moneda distinta a la base, para no sumar ruido cuando no hace falta. "Moneda original" es el
comportamiento de siempre (cada posición en la moneda del instrumento); "En {moneda base}" usa la
misma conversión que ahora protege el total, con "Sin cotización" para lo que quedó afuera.

### Agregado — cantidad con stepper y teclado, precio con teclado y moneda indicada, cuenta con moneda visible

En `trades/new` (cargar una operación): la cantidad pasa de un `<Input type="text">` a un número
centrado con ±1 a los costados para el caso común (unidades enteras) y teclado numérico propio
(tocando el número) para cantidades grandes o fraccionarias — mismo patrón de teclado que
`/currencies`, reutilizando `appendKeypadRateDigit` (es un acumulador de dígitos genérico pese al
nombre, no específico de tipos de cambio). El precio unitario indica la moneda del instrumento en
la etiqueta ("Precio unitario (USD)") y también se edita por teclado numérico, nunca `<input
type="number">` (CLAUDE.md). La cuenta de liquidación ahora muestra su moneda junto al nombre —
antes "Itaú" a secas no alcanzaba para distinguir dos cuentas Itaú en monedas distintas.

### Agregado — los precios ahora se piden en vivo al entrar a "Estado de precios" (I12)

Antes esa pantalla solo mostraba `price_snapshots` cacheado (el cron diario), así que un
instrumento podía figurar "viejo" con el mercado ya teniendo un valor fresco. Al entrar se pide la
cotización en vivo de cada instrumento con proveedor — `refreshFromProvider` no escribe
`price_snapshots` (esa persistencia es del cron), así que el resultado se guarda aparte y gana
sobre el cache al mostrar el estado.

### Arreglado — dos modales de inversiones con `height` fija y contenido corto

"Editar clase" (Clases de activos) y "Actualizar precio" (Estado de precios) forzaban una altura
de sheet mayor a la de su contenido real (un `Input` + uno o dos `Button`), dejando aire vacío en
vez de ajustarse — mismo defecto reportado para este modal puntual, corregido sacando el `height`
fijo (`Sheet` por defecto ya es `"auto"`).

### Cambiado — "Agregar instrumento" en vez de "Crear instrumento a mano"

Quedó desactualizado por 0.29.4: la pantalla de creación de instrumentos arranca en modo búsqueda
desde esa versión, "a mano" ya no es lo que hace el botón por default.

## [0.29.6] — 2026-08-06

### Agregado — el buscador flotante ahora cubre tags y cualquier sección de la app

Tres huecos en `SearchOverlay`. Primero: un movimiento se encontraba por categoría pero nunca por
sus tags — "Cliente" como tag no aparecía en ningún resultado aunque el movimiento estuviera
etiquetado así. `rank.ts` suma `keywords` a `Searchable`: puntúan igual que título/subtítulo pero
nunca se muestran en la fila (ya se ven en el detalle del movimiento), y hay un nuevo grupo "Tags"
que además deja buscar el tag directo como destino (`/transactions?tag=<id>`, mismo patrón que
`?category=`/`?payee=` — nuevo en `filter-predicate`/`page.tsx`, ya existía el campo
`filters.tagIds` sin ninguna forma de sembrarlo por URL). Las notas/descripción del movimiento en
realidad ya se buscaban (título si no hay categoría, subtítulo si la hay) — confirmado, sin cambios
ahí.

Segundo, más grande: los "accesos rápidos" del buscador eran 6 rutas fijas (agregar, dashboard,
movimientos, cuentas, análisis, más), así que escribir "grup" no encontraba "Grupo familiar" — la
sección ni siquiera estaba en la lista, no era un problema de scoring. Se reemplaza por el mismo
inventario de `/more` (categorías, tags y comercios, reglas, tipos de cambio, perfil, seguridad,
notificaciones, sincronización, ajustes, datos y backup, acerca de, panel del operador si es admin,
y presupuestos/metas/recurrentes/deudas/inversiones/familia si el módulo está prendido — mismo
gating por `enabled_modules` que ya usa `/more`), reusando los mismos `next-intl` keys que esas
pantallas ya tienen, sin duplicar ningún string.

Tercero: el matching de esos accesos era un `.includes()` crudo sin normalizar acentos — se
reemplaza por el mismo `scoreMatch`/`normalize` que ya usa el resto del buscador, por consistencia
("seguridad" sin tilde encontraba igual por casualidad del substring, pero "análisis" sin tilde no
hubiera matcheado "Análisis").

## [0.29.5] — 2026-08-06

### Agregado — el override manual de FX ahora se sincroniza con el servidor

`fx_overrides` y `household_fx_preferences` existían en el schema desde `01-arquitectura-datos.md`
§ 2.6 (la primera con RLS desde `20260801010800_fx_overrides.sql`, la segunda desde el día 1 de
identidad), pero ningún caller les escribía nunca: `setManualOverride`/`clearManualOverride`/
`setPreference` (`fx-repo.ts`) solo tocaban Dexie. Consecuencia doble — cargar un rate a mano en
un dispositivo no se veía en los demás del household, y el cron
`materialize_recurring_transactions()` (`perze-materialize-recurring`), que sí consulta
`fx_overrides` server-side, nunca encontraba nada ahí.

Nuevos `fx-overrides-repo.ts` y `fx-preferences-repo.ts` escriben directo a Supabase (mismo patrón
que `currencies-repo.ts`, sin outbox — no es una mutación de plata) con push-through best-effort
desde `fx-repo.ts`: si falla (offline, error del servidor) el valor local ya quedó aplicado, nunca
bloquea. `fx_overrides` es bitácora inmutable (`valid_from`/`valid_to`) — cambiar el rate cierra la
vigencia anterior un día antes de abrir la nueva, nunca se pisa `rate` de una fila existente.
`/currencies` y `/accounts/resolve-fx` ahora pasan `createdBy` (antes ninguno de los dos llamaba
con el usuario real).

Nuevo `fxRepo.syncFromServer()` trae los overrides/preferencias vigentes y los cachea en Dexie —
deliberadamente NO vive dentro de `resolve()` (que corre en cada guardado de movimiento y violaría
el objetivo de <5s de CLAUDE.md), se llama explícito al entrar a `/currencies` y al tocar
"Actualizar".

`fx-overrides-repo.ts`/`fx-preferences-repo.ts` se importan con `import()` dinámico desde
`fx-repo.ts`, no estático — ambos arrastran `supabase/client.ts`, que valida `env.ts` al cargar el
módulo, y un import estático rompía cualquier test que importe `fx-repo.ts` sin mockear Supabase
(la mayoría: lógica pura de captura/movimientos). `fx-repo.test.ts` suma un mock de
`../supabase/client` para las nuevas rutas que sí lo ejercitan.

## [0.29.4] — 2026-08-06

### Agregado — buscador de instrumentos al crear una inversión, con precio de mercado precargado

I7 pedía inventar el símbolo y el nombre de memoria (`TSLA`, `AAPL`...) en un formulario manual
como única vía. Ahora `/investments/[portfolioId]/instruments/new` arranca en modo búsqueda:
un input contra `/api/instruments/search` (nueva ruta, único punto de egreso — el cliente nunca
llama a Data912 ni a CoinGecko directo, mismo criterio que `/api/fx`/`/api/prices`) que combina
acciones/CEDEARs/bonos/ONs/letras del mercado argentino (Data912) con el listado curado de
cryptos. Elegir un resultado deriva `priceProvider`/`providerSymbol`/`currencyCode` — nadie vuelve
a escribir esos tres campos a mano — y si el household ya tiene ese instrumento con ese proveedor,
lo reusa en vez de duplicar el catálogo ("Ya la tenés"). El formulario manual sigue existiendo
para lo que ninguna fuente cubre (FCI, plazo fijo, inmuebles, ETFs internacionales), accesible con
"¿No lo encontrás? Crear a mano", nunca como paso obligatorio.

Al cargar una operación (`trades/new`), elegir un instrumento con `priceProvider` ahora dispara
`priceSnapshotsRepo.refreshFromProvider()` y precarga el precio unitario con la cotización del
momento — editable, nunca de solo lectura — en vez de dejar el campo vacío esperando que el
usuario recuerde el valor de mercado.

`navigation-uses-replace.test.ts` — el buscador sumó un tercer punto de salida (elegir un
resultado también hace `router.back()`, igual que guardar a mano); el guardarraíl de conteo de
`instruments/new/page.tsx` pasa de 2 a 3.

## [0.29.3] — 2026-08-06

### Arreglado — elegir blue/CCL/mayorista no hacía nada con un override manual vigente

El override manual es siempre el primer paso de la cadena de resolución de FX — gana incluso
sobre una preferencia de `quoteKind` recién elegida en el picker de `/currencies` (0.28.9):
`setPreference` guardaba la elección, pero `resolveFxRate` ni siquiera llegaba a mirarla mientras
hubiera un override vigente para el par. Un household que alguna vez cargó un valor a mano
quedaba sin forma de volver a elegir una cotización de mercado real. Elegir una variante ahora
limpia el override del par antes de guardar la preferencia — es una decisión explícita de "quiero
esta cotización, no la que tipeé a mano".

## [0.29.2] — 2026-08-06

### Arreglado — dos detalles visuales en mobile: el banner de recordatorios y la barra de scroll

- **El banner de recordatorios (0.28.3) bleedeaba edge-to-edge con `border-radius` puesto** —
  la combinación no tiene sentido: al pintar exactamente ancho completo, las esquinas quedan
  recortadas contra el borde del viewport y se ven cuadradas, con el ícono pegado al borde
  lateral. Se saca el `margin` negativo, mismo tratamiento que `InsightCard` (el card de alerta
  de presupuesto, que sí se ve como card de verdad).
- **La barra de scroll nativa quedaba mucho más adentro del borde real del viewport en mobile**
  que en `/transactions` — no era solo el dashboard: las 5 pantallas con scroller propio
  (`OWN_SCROLLER_ROUTES`) salvo `/transactions` tenían el mismo problema, un `paddingRight: 8`
  sumado ARRIBA del padding lateral que ya reserva `<main>`. `/transactions` se veía bien de
  pura casualidad — tiene un `margin`/`padding` propio para una razón completamente distinta (el
  sangrado del resalte de fila seleccionada) que de paso corregía esto. Nuevo utility
  `scroll-gutter-right` (`globals.css`) aplicado a las 5 pantallas: deja el contenido exactamente
  donde estaba y acerca la barra al borde real, documentado en `02-design-system.md` § 4 para que
  cualquier pantalla nueva con scroll propio lo use en vez de un `paddingRight` suelto.

## [0.29.1] — 2026-08-06

### Arreglado — el switch Personal/Compartido/Todo aparecía en pantallas donde no filtraba nada

Se mostraba en CUALQUIER pantalla raíz de tab con 2+ miembros — `/investments`, `/recurring`,
`/more`, cualquier cuarto slot — sin que esas pantallas leyeran `scope` en absoluto: aparecía,
prometía filtrar, y no hacía nada. Ahora solo se muestra en las 4 pantallas que de verdad lo
usan (`SCOPE_AWARE_ROUTES` en `(app)/layout.tsx`): dashboard, movimientos, cuentas y análisis. En
el resto, el logo (mobile) o el título de la pantalla (desktop) vuelven a ocupar ese lugar, como
en cualquier otra pantalla de la app.

De paso, se cierra el hueco real: `/transactions`, `/accounts` y `/analytics` no filtraban por
scope aunque el dashboard sí lo hacía desde la sesión anterior — ahora las tres respetan el
mismo criterio (`accountMatchesScope`, `visibility` de cada cuenta) para sus cuentas,
movimientos, patrimonio neto y resúmenes.

## [0.29.0] — 2026-08-06

### Agregado — núcleo del bloque I: portfolios múltiples, detalle de instrumento y precios reales

Alcance acordado como "núcleo" tras auditar todo el bloque I (I1-I12 en distinto estado, la
mayoría ya funcional): los tres huecos pedidos explícitamente, dejando I6 (registrar renta), I1
(activación con cuenta broker), TWR/benchmarks y el objetivo de allocation para una fase
siguiente.

- **Portfolios múltiples de verdad.** El schema y el repo ya soportaban varios portfolios por
  household, pero cada pantalla asumía `portfolios[0]` — sin selector, sin forma de crear un
  segundo. `/investments` pasa a ser la lista (mismo rol que `/accounts` para cuentas, "+ Nuevo
  portfolio" incluido); el overview de siempre se mueve a `/investments/[portfolioId]`, mismo
  patrón de ruta que ya usaban `trades/new`/`instruments/new`.
- **I4 — detalle de instrumento, antes un link roto en producción.** `OverviewContent` ya
  navegaba a `positions/[instrumentId]`, pero esa ruta nunca se había escrito. Ahora muestra la
  posición (valor + P&L no realizado), precio promedio, peso en el portfolio, estado del precio
  con botón de actualizar, y el historial completo de operaciones de ese instrumento — cuánto
  creció desde la compra hasta hoy, no solo el número final.
- **Cotizaciones reales de mercado.** Cero proveedores implementados hasta ahora, pese a que la
  fuente ya estaba decidida en `01-arquitectura-datos.md`. Se agrega **Data912** (mercado
  argentino — acciones, CEDEARs, bonos, ONs, letras, comunitaria, sin API key) y **CoinGecko**
  para instrumentos cripto, con el mismo patrón ya probado en FX: un cron diario
  (`daily-price-sync`) que puebla `price_snapshots`, y `/api/prices` como única puerta para un
  refresh puntual — el cliente nunca llama a un proveedor externo directo. Al crear un
  instrumento (I7b), la clase de activo elegida ahora deriva automáticamente `price_provider`/
  `provider_symbol`; el resto (FCI, plazo fijo, inmuebles) sigue con precio a mano, el camino de
  primera clase, no un fallback.
- **De paso, un bug de RLS real en producción**: `price_snapshots` solo tenía policy de `SELECT`
  — "cargar un precio a mano" (I12) hacía un `.upsert()` desde el cliente que la base rechazaba
  en silencio. Nueva policy acotada a `provider = 'manual'`: cualquier autenticado puede agregar
  su precio manual, nunca puede escribir con el `provider` de una fuente real.

## [0.28.9] — 2026-08-06

### Arreglado — "Actualizar" no traía nada, y el rate se mostraba como "0,0000025"

- **`/currencies` con `baseCurrency = UYU` (el default de cualquier household nuevo) nunca tenía
  cotización real.** Ninguno de los dos proveedores implementados cubre UYU: `dolarapi.ts` solo
  hace USD↔ARS, `frankfurter.ts` no cubre monedas LatAm. Tocar "Actualizar" corría el flujo
  entero sin ningún bug de caché/invalidación — simplemente no había a dónde ir a buscar el dato.
  Se agrega `dolarapi-uy.ts` (`uy.dolarapi.com/v1/cotizaciones`), que cierra el hueco para
  USD/EUR/ARS/BRL/GBP/CHF/PYG contra UYU.
- **El rate se mostraba siempre en la dirección `moneda → base`**, sin importar cuál de las dos
  valía más — así que cualquier moneda más débil que la base (el caso común: ARS/UYU contra USD)
  arrancaba mostrando una fracción minúscula tipo "0,0000025" en vez de "1 USD = 1.520 ARS". Ahora
  el default muestra la dirección donde 1 unidad de la moneda fuerte equivale a varias de la
  débil; el botón de invertir sigue disponible para pisar ese default. De paso, `roundRateForDisplay`
  pasa de un corte fijo de 6 decimales a escalar según la magnitud real (~4 cifras significativas),
  para que un par con más orden de magnitud de diferencia no termine igual de ilegible.
- **Dólar blue/CCL/tarjeta ya estaban soportados de punta a punta en el modelo de datos**
  (`fx_rates.quote_kind`, `household_fx_preferences`, `dolarapi.ts` ya trae las 7 variantes) pero
  no había ninguna UI para elegir — la ruta `/api/fx` resolvía UNA sola y descartaba el resto en
  silencio. Ahora la ruta devuelve todas las variantes conocidas del día y `/currencies` las
  ofrece como chips clickeables por moneda; elegir una la guarda como preferencia del household
  para ese par (`fxRepo.setPreference`, ya existía, sin ningún caller hasta ahora).
- **Cripto sin ningún proveedor real** — estaba en el diseño desde el origen (`fx_provider`
  admitía `'coingecko'` como valor desde la primera migración) pero nunca se escribió el módulo.
  Se agrega `coingecko.ts` (`/simple/price`, sin API key), con las cryptos más comunes
  (BTC/ETH/USDT/USDC/BNB/SOL/XRP/ADA/DOGE/DOT/LTC) contra los fiat que CoinGecko cotiza
  directo — UYU no está en su lista de `vs_currencies`, así que cripto↔UYU sigue sin cobertura.
- El cron diario (`daily-fx-sync`) se actualiza en paralelo con los mismos dos proveedores nuevos,
  y de paso se corrige su lista de monedas Frankfurter, que tenía solo 14 de las 30 reales —
  estaba desalineada de `frankfurter.ts` del cliente desde que ese archivo se corrigió.

## [0.28.8] — 2026-08-06

### Agregado — landing pública en `/start`

El link que se comparte de afuera hoy caía directo en el formulario de email de A2, sin contarle
a un visitante nuevo de qué se trata la app. `proxy.ts` ahora manda a `/start` (no a `/onboarding`)
a cualquier sesión sin autenticar que entra a "/" — el resto de las rutas protegidas sigue yendo
directo a `/onboarding`, un deep link ya trae intención propia. El CTA de la landing entra por
`/onboarding/welcome` (A1, los 3 slides deslizables que ya existían en código), no directo al
formulario de email.

Mismo patrón que `/about` (server component, sin sesión, indexable, fuera del shell de `(app)/`),
sumada a las tres allowlists que tienen que coincidir (`PUBLIC_PREFIXES`, `EXEMPT_PREFIXES` de
`OnboardingGate`, `PIN_EXEMPT_PREFIXES` de `PinGate`) y a `robots.ts`/`sitemap.ts`. El fondo de
puntos con degradé fundido hacia los bordes es decorativo y siempre está prendido acá — recicla
los tokens de `page-backdrop` (`--dot-gap`/`--dot-size`/`--dot-ink`) sin depender del atributo
`data-backdrop`, que es opt-in y un visitante nuevo nunca activó.

## [0.28.7] — 2026-08-06

### Arreglado — las monedas nuevas no se agregaban de verdad, en ningún lado

Dos síntomas del mismo problema de fondo: `currencies` es un catálogo global de solo lectura para
el cliente (Patrón C — CLAUDE.md), y nada en la app tenía forma real de escribir ahí.

- **`/currencies` (E6) dejaba tipear cualquier código libre** y lo trataba como válido apenas
  pasaba una regex de forma (`/^[A-Z0-9]{2,10}$/), sin chequear que existiera en el catálogo real.
  Localmente "parecía" funcionar (el override de FX quedaba en Dexie), pero rompía después:
  `fx_rates.base` tiene una foreign key contra la tabla `currencies`, así que el sync fallaba, y
  `/api/fx` respondía `MONEDA_DESCONOCIDA` apenas alguna otra pantalla pedía esa cotización.
  Ahora, si el código tipeado no está en el catálogo, se pide nombre y tipo (fiat/cripto) y se crea
  de verdad antes de seguir.
- **El selector de moneda al crear una cuenta era una lista estática de 7 monedas hardcodeadas**
  (`countries-currencies.ts`), sin leer el catálogo real (33+ monedas sembradas) ni forma de
  agregar una nueva — ni siquiera cripto, que el catálogo nunca tuvo sembrada. Ahora lee el
  catálogo real vía `useCurrencies()` y suma un chip "Otra moneda" que abre el mismo flujo de alta.

La escritura pasa por una función nueva, `add_currency` (`SECURITY DEFINER`), documentada como
excepción puntual al Patrón C — cualquier autenticado puede sumar una fila al catálogo global
(útil para cripto y monedas fuera de la cobertura actual), pero solo con datos que pasan
validación de forma, nunca pisando una fila existente.

## [0.28.6] — 2026-08-06

### Arreglado — el switch Personal/Compartido/Todo no aparecía y, cuando aparecía, no filtraba nada

Dos bugs distintos en el mismo control, encontrados al revisar por qué no se veía con un household
de 2 miembros:

- **`(app)/layout.tsx` calculaba la visibilidad del switch con `useHouseholdMembers`, que lee
  Dexie local** — y Dexie local solo tiene la fila del propio dueño del dispositivo: un miembro
  que otro invitó y aceptó desde SU dispositivo nunca baja ahí sin un pull-sync que todavía no
  existe. Resultado: el switch nunca aparecía para el owner, aunque el household tuviera 2+
  miembros de verdad. Se cambia a `useRemoteHouseholdMembers` (la misma fuente que ya usa
  correctamente Grupo familiar), que lee Supabase directo.
- **Aunque apareciera, no hacía nada.** El store (`useScopeStore`) y el `SegmentedControl` en
  `AppHeader` estaban completos —tal como pide el contrato tras la migración de
  `ScopeSwitcher`—, pero ningún hook de datos leía `scope`: cambiar entre Personal/Compartido/Todo
  no alteraba ni una cifra del dashboard. Ahora el home filtra cuentas por `visibility`
  (`private` → Personal, `household`/`custom` → Compartido, sin filtro → Todo) y de ahí se derivan
  patrimonio neto, gastado/ingresado del período y movimientos recientes — todo lo que ya se
  mostraba, ahora respeta el scope elegido. Se suma un estado vacío distinto ("nada en este
  scope") para no confundirlo con el de onboarding cuando el household tiene datos pero no en el
  scope actual.

## [0.28.5] — 2026-08-06

### Arreglado — el mail de aviso al operador nunca llegaba (proyecto migrado al sistema de API keys nuevo)

`notify-access-request` devolvía `401 unauthenticated` en silencio en cada intento, incluso con
los dos secrets de Vault (`perze_project_url`/`perze_service_role_key`) cargados correctamente.
Causa real, confirmada probando el Edge Function directo con `curl`: el proyecto ya migró al
sistema de API keys nuevo de Supabase (`sb_secret_...`), y un Edge Function con `verify_jwt = true`
deja de aceptar el `service_role` **legacy** (el JWT viejo) como credencial válida — sin ningún
error visible del lado de la app, solo el 401 de la plataforma. Se actualizó el secret de Vault al
`sb_secret_...` correcto y se verificó de punta a punta contra el trigger real. Documentado en
`docs/self-hosting.md` para que ningún self-host futuro pierda el tiempo con el mismo síntoma.

### Agregado — aviso al owner/admin cuando alguien acepta su invitación al hogar

Mismo patrón que el aviso de "nueva solicitud de acceso" (0.28.0), del otro lado del flujo J3:
`supabase/functions/notify-invite-accepted`, disparada por un trigger nuevo en
`household_invites` que dispara `net.http_post` cuando `accepted_by` pasa de `NULL` a un valor
real. Manda a todo owner/admin activo del hogar (nunca al que se acaba de unir), con el mismo
criterio de "sale en silencio sin los secrets de Resend" que el resto de los avisos por mail.

## [0.28.4] — 2026-08-06

### Arreglado — remover a alguien del hogar no le cortaba el acceso real (seguridad)

Auditoría del bloque J completa tras el primer invitado real de producción. Tres brechas reales,
encontradas antes de que las explotara nadie más que esta sesión de pruebas:

- **`current_households()` y `can_write()` nunca filtraban `status`.** Son la base de
  prácticamente toda la RLS del esquema (cuentas, movimientos, presupuestos, invitaciones, lo que
  cuelga de estas dos funciones). Marcar a un miembro `status: 'former'` (sacarlo del hogar) lo
  sacaba de la lista en la UI, pero su sesión seguía leyendo y escribiendo el household completo
  para siempre — vía la API directa, no solo por la app. Los tres fixes de la 0.28.2 arreglaron el
  síntoma visual, no el corte de acceso real. Ahora las dos funciones exigen `status = 'active'`.
- **Cualquier miembro veía el código de cualquier invitación pendiente del household**, no solo
  las propias — la policy de `household_invites` no filtraba por rol, y la UI lo pintaba en
  pantalla. Con el código, cualquiera podía canjear una invitación ajena y actualizarse el propio
  rol (`accept_invite()` deja que el `role` de la invitación se aplique al canjear). Ahora la
  policy de `SELECT` exige `is_household_admin()`.
- **Un household podía quedarse sin ningún owner activo** por la vía de "sacar del hogar"
  (`markHouseholdMemberFormer`, que solo toca `status`, nunca `role`). Ya existía una guarda
  (`enforce_household_role_changes()`) para cambios de `role`, pero no cubría este caso porque no
  toca `role`. Trigger nuevo, acotado a ese hueco puntual — sin duplicar la guarda que ya
  funcionaba bien para lo suyo.
- De paso, se revocaron 3 invitaciones de prueba que habían quedado sin aceptar ni revocar en el
  household de producción (una con un email corrupto, `"M"`, de una prueba vieja).

## [0.28.3] — 2026-08-06

### Arreglado — "Efectivo"/"Otro" hardcodeados, CTA de gasto contra saldo cero, instalar PWA en un paso

- **`accountPreset` guardaba el `AccountKind` a mano comparando el nombre del preset contra el
  string literal `"Efectivo"`** — imposible de traducir sin romper la inferencia, y de paso
  perdía el `kind` real de cualquier banco (`Itaú` caía al default `"wallet"` en vez de
  `"savings"`, porque nunca se guardaba). `useOnboardingStore` ahora guarda `accountKind`
  directo, separado del label — A6 lo fija al elegir el preset (traducido con
  `reference.accountKind.*`, el mismo catálogo que usa el resto de la app) y A11 lo lee tal cual.
- **El CTA de éxito del onboarding ofrecía "Cargar mi primer gasto" sobre una cuenta que siempre
  arranca en 0** — A7 (el saldo real) se pide recién después, así que el primer gasto real
  llevaría el saldo a negativo sin ningún movimiento que lo explique. Ahora, si la cuenta está en
  cero, ofrece cargar un ingreso primero (mismo botón, mismo destino — `/add` con el tipo de
  captura en `income`).
- **Instalar la PWA después del primer gasto (A10) tenía tres mensajes fijos y un botón que solo
  aparecía con `beforeinstallprompt` disponible** — sin chequear si la app ya estaba instalada.
  Ahora reusa el mismo patrón maduro de Ajustes → Instalar app: un solo botón que instala en un
  toque donde el navegador lo permite (Chrome/Edge en Android, Windows, macOS), y abre la guía
  exacta por plataforma donde no hay API programática (iOS/iPadOS Safari nunca dispara ese
  evento — restricción de Apple, no evitable desde el código). Si `isStandalonePwa()` ya da
  `true`, el paso se saltea entero.

### Agregado — recordatorios de baja intensidad en el dashboard

- Banner opcional en el home que sugiere, de a uno por vez y rotando por día, cosas que se pueden
  ajustar y que nadie encuentra si no las busca: cumpleaños, formato de fecha y números, tema,
  fondo de puntos, instalar la app, o activar más módulos. Nunca una lista ("3 cosas
  pendientes"), nunca compite con los banners más urgentes (offline, conflicto, cumpleaños de
  hoy — si hay alguno de esos, el recordatorio no se muestra). Dos niveles de silencio: la X
  calla hasta mañana, "No mostrar más recordatorios" apaga el sistema entero, para siempre, en
  este dispositivo.

## [0.28.2] — 2026-08-06

### Arreglado — un miembro invitado al grupo familiar quedaba sin ver nada del hogar al que entró

Encontrado en vivo probando la invitación real de punta a punta, tres bugs distintos en la misma
cadena:

- **`/join` nunca marcaba el household aceptado como activo en este dispositivo.** `accept_invite`
  y la hidratación scoped funcionaban bien, pero nadie llamaba a
  `householdsRepo.setCurrentHouseholdId()` después: `useCurrentHousehold()` lee solo ese puntero
  local (`meta.currentHouseholdId`), así que un invitado que ya tenía su propio household (por
  ejemplo, alguien que ya había pasado por A11 antes de recibir la invitación) seguía viendo el
  suyo — cuentas, movimientos y todo — después de "aceptar" el del otro. Ahora `/join` fija el
  household activo y publica `profiles.default_household_id` (mismo patrón AC-3 de
  `onboarding/success`) apenas el canje sale bien.
- **`household_members.display_name` nunca se sincronizaba con `profiles.display_name`.** Es una
  copia denormalizada a propósito (el resto del hogar no tiene tu perfil en su Dexie local), pero
  `accept_invite()` insertaba la fila sin ella (quedaba `NULL` → "Sin nombre" para siempre) y
  ningún trigger la actualizaba si alguien se renombraba después desde `/more/profile` — ni
  siquiera el propio dueño del hogar. Migración nueva: `accept_invite()` la puebla al aceptar, y
  un trigger `AFTER UPDATE OF display_name ON profiles` la mantiene sincronizada para siempre, con
  backfill de las filas que ya habían quedado desincronizadas en producción.
- **Sacar a alguien del hogar no lo sacaba de la lista.** `markHouseholdMemberFormer()` sí
  marcaba `status: 'former'` en la base, pero `listRemoteHouseholdMembers()` nunca filtraba por
  `status`, así que J1 seguía mostrando al miembro removido como si nada. Peor: si después se lo
  volvía a invitar y aceptaba de nuevo, `accept_invite()` tenía `ON CONFLICT DO NOTHING` sobre esa
  misma fila `former` — el "aceptar" no tiraba error, pero la fila nunca volvía a `active`, así
  que no había forma real de que alguien removido volviera a entrar. Se corrigen los dos: el
  `SELECT` ahora excluye `status = 'former'`, y el `ON CONFLICT` pasa a `DO UPDATE` que reactiva la
  fila (`status`, `role`, `display_name`, `joined_at` al día, `left_at` en `NULL`).
- Además, sacar a alguien del hogar ahora pide confirmación explícita con las consecuencias antes
  de ejecutarse — la excepción justificada al patrón "reversible, no confirmable" de `CLAUDE.md`,
  porque a diferencia de la mayoría de las acciones de la app esta corta el acceso de OTRA
  persona al instante, no solo el propio.

## [0.28.1] — 2026-08-06

### Arreglado — la causa real de "solicitudes pendientes" vacío (el `LEFT JOIN` de 0.28.0 no era)

- El `INNER JOIN` → `LEFT JOIN` de la 0.28.0 fue una mejora legítima, pero no era la causa: la
  función seguía fallando igual después de aplicarla, confirmado en producción con tres
  solicitudes reales. La causa real, encontrada recién ahora con el mensaje de error completo del
  lado del navegador: `42804 — structure of query does not match function result type` — `auth.users.email`
  es `character varying(255)`, no `text`, y Postgres exige coincidencia exacta de tipo en el
  `RETURN QUERY` de una función `RETURNS TABLE` (a diferencia de un `SELECT` suelto, donde
  `varchar`/`text` son intercambiables sin quejarse — por eso correr el mismo `SELECT` a mano
  nunca mostraba el problema). Cast explícito: `u.email::text`.
- Este bug es anterior a todo lo demás: estaba en la función desde que se creó
  (`20260801180000_access_control.sql`) y nunca se había notado porque nadie había llamado a
  `admin_list_access_requests()` con una fila real de por medio — el operador siempre nace
  aprobado, así que el panel jamás se había ejercitado con una solicitud pendiente de verdad hasta
  esta sesión de pruebas.
- De paso, el panel tragaba cualquier error de esta consulta en silencio y lo mostraba igual que
  "no hay nada" — un fallo real y una lista genuinamente vacía se veían idénticos. Ahora
  distingue los dos casos con un `ErrorState` y reintento.

## [0.28.0] — 2026-08-06

### Agregado — aviso al operador de una solicitud de acceso nueva

- Hasta ahora la única forma de enterarte de que alguien pidió entrar era abrir la app y entrar a
  Panel del operador a mano. Ahora hay dos avisos, sumados juntos:
  - **Mail al operador** — `handle_new_user()` dispara la Edge Function nueva
    `supabase/functions/notify-access-request` vía `net.http_post` apenas nace un perfil
    `pending`, mismo patrón de Vault (`perze_project_url`/`perze_service_role_key`) que
    `dispatch_due_notifications()`. Con branding liviano (wordmark, tokens de marca), manda a
    **todos** los `is_app_admin` de la instancia, no solo al primero. Necesita sus propios
    secrets de Edge Function (`RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` —
    `docs/self-hosting.md` § 1.7): sin ellos, el alta funciona igual y el mail simplemente no
    sale, nunca bloquea a nadie.
  - **Badge en la tab bar** — el contrato de `TabItem` ya soportaba un `badge` numérico (CON-13,
    pensado justo para esto) y no se usaba. El tab "Más" ahora lo muestra con la cantidad de
    solicitudes pendientes, solo para el operador; la fila "Panel del operador" adentro de Más
    repite el conteo como texto.

### Arreglado — la lista de "solicitudes pendientes" del panel del operador aparecía vacía

- Las métricas contaban bien ("Pendientes: 1"), pero la lista de abajo — de donde se aprueba o
  rechaza — mostraba "No hay solicitudes esperando aprobación" al mismo tiempo. La causa: el JOIN
  contra `auth.users` para traer el email era `INNER`, y perdía la fila en silencio para al menos
  un caso real en producción; `admin_metrics()` cuenta bien porque consulta `profiles` sola, sin
  ese join. Pasa a `LEFT JOIN` — una solicitud real nunca desaparece de la lista por un problema
  de resolución del email; en el peor caso el email sale vacío y la fila cae a mostrar el nombre o
  el id.

## [0.27.2] — 2026-08-06

### Arreglado — la invitación al household nunca se canjeaba para un invitado sin aprobar

- El gate de acceso controlado (`access_status !== "approved"` → `/pending`) corría **antes** de
  chequear si había un código de invitación pendiente, en los tres lugares que deciden destino
  después de verificar sesión: `/onboarding` (link clickeado), `/onboarding/verify` (código
  tipeado) y `/pending` (al quedar aprobado). Un invitado nuevo, que por diseño siempre entra sin
  aprobar, quedaba varado en "tu acceso está esperando aprobación" con el código sin canjear —
  `household_invites.accepted_by` nunca se escribía, así que ni figuraba como usado para quien
  invitó, y al aprobarlo el sistema le creaba un household propio por default en vez de sumarlo al
  que lo invitó.
- El canje de una invitación no depende de la aprobación del operador — `/join` es pública y
  `accept_invite()` solo exige `auth.uid()` — así que el chequeo del código pendiente pasa a correr
  primero en los tres lugares.

## [0.27.1] — 2026-08-06

### Arreglado — A3 con código ignoraba el household existente y creaba uno nuevo

- Verificar el código de 6 dígitos hacía `router.push` directo a `/onboarding/country` (A4) sin
  chequear si el usuario ya tenía un household en el servidor — a diferencia del camino del link
  clickeado (`/onboarding`), que sí llama a `resolveOnboardingDestination()`. Cualquier reingreso
  por código (dispositivo o `localStorage` limpio, el caso típico de cerrar sesión para probar algo
  en dev) mandaba a crear una cuenta nueva en vez de restaurar la existente.
- Bug preexistente que nunca se disparaba en la práctica: con `NEXT_PUBLIC_AUTH_OTP_CODE` apagado
  por default, A3 nunca mostraba el input de código. Quedó expuesto recién en la 0.27.0, cuando el
  código pasó a ser el único camino de A3.

### Arreglado — `robots.txt` y `sitemap.xml` redirigían a `/onboarding`

- No existían: `/robots.txt` caía en `proxy.ts` como cualquier ruta sin sesión y volvía un 307 a
  `/onboarding`. Un robots.txt que redirige a un login se lee como "todo el sitio requiere sesión" —
  probablemente la causa de que la verificación de marca de Google Auth Platform siguiera fallando
  aunque `/about` respondiera bien al pedirla directo. Se agregan ambos (`src/app/robots.ts`,
  `sitemap.ts`), excluidos del matcher de `proxy.ts`, permitiendo solo `/about`.
- Se suma `applicationName: "PERZE"` a los metadatos globales — señal explícita de nombre de app
  que Google compara contra la pantalla de consentimiento OAuth al verificar la marca.

## [0.27.0] — 2026-08-06

### Agregado — Google OAuth y Resend con el branding de Perze, de punta a punta

- El mail de Auth default de Supabase entregaba **solo a miembros del proyecto** y con tope de
  2/hora: ningún usuario real podía recibir su código. Las plantillas de magic-link y recovery se
  reescriben con react-email (`src/emails/`) — wordmark, tokens de color en modo claro, tipografía
  Inter (Geist no existe en un cliente de mail) — y se exportan a `supabase/templates/*.html` con
  `pnpm email:export`, para pegar a mano en el Dashboard (plan free sigue rechazando
  `config push` para plantillas, con o sin SMTP propio).
- **Google OAuth**, ya programado y apagado por falta de credenciales, se enciende con
  `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS=google`. Faltaba una sola cosa: el colapso del email bajo
  "Usar mi email" que exige `CLAUDE.md` § "Orden de A2" — el archivo de diseño lo dibuja siempre
  visible, pero `CLAUDE.md` es la autoridad mayor y es categórico.
- **Invitación al household (J3) por email** — `household_invites.email` se guardaba y nadie la
  usaba; el código se compartía a mano. Ahora `/family/invite` dispara el mail vía
  `POST /api/emails/invite` (Route Handler + Resend, no Edge Function: corre con la sesión del
  usuario y RLS como barrera, sin necesitar `service_role`). Es la única plantilla con i18n real
  (ES/EN/PT) — las de Auth van fijas en español porque el Dashboard de Supabase no tiene noción de
  locale por plantilla.
- **Se revierte la solución de transición de contraseñas** (`/login`, `/onboarding/register`,
  `/forgot-password`, `/reset-password`, cookie `perze_registered`) que existía desde principios de
  agosto mientras el mail no funcionaba de verdad. `CLAUDE.md` es categórico: sin contraseñas, ni
  acá ni nunca. Las rutas viejas no se borran — quedan como stubs `redirect("/onboarding")`
  (una PWA instalada con historial largo no puede recibir un 404) — se borran del todo en una
  release futura. `NEXT_PUBLIC_AUTH_OTP_CODE` se elimina: el código de 6 dígitos es el único camino
  de A3, no un flag. La hoja de "Contraseña" de `/more/security` se saca (queda PIN + biométrico).
- **Página pública `/about`** — Google Auth Platform exige, para verificar el logo de la pantalla de
  consentimiento OAuth, que la "Application home page" sea un URL público (sin login) que explique
  el propósito de la app. `/` no servía: sin sesión, `proxy.ts` redirige a `/onboarding` (login)
  antes de renderizar nada. `/about` es nueva, pública e indexable, sin tab bar, y sirve tanto de
  home page como de privacy policy link ante Google.

### Agregado — páginas de not-found y error con la marca de Perze

- El 404 y el error boundary eran los genéricos de Next, sin ningún token de marca, tanto dentro
  del shell autenticado como fuera. Ahora hay `not-found.tsx`/`error.tsx` en dos niveles — la raíz
  (sin sidebar) y dentro de `(app)/` (con sidebar/tab bar, para una navegación de cliente rota ya
  adentro de la app) — reusando `EmptyState`/`ErrorState` del design system, que ya traen el `ZMark`
  de marca. `global-error.tsx` es la red de último recurso si el layout raíz mismo falla: la única
  pantalla de la app sin next-intl, a propósito, porque reemplaza `Providers`/`IntlBoundary` enteros.

### Arreglado — cerrar sesión se colgaba para siempre en `pnpm dev`

- `signOut()` llama primero a `unsubscribeFromPush()`, que hacía `await navigator.serviceWorker.ready`
  sin chequear si había un service worker activo. En dev el SW no se registra por default
  (`CLAUDE.md` § gotchas: Turbopack cambia los nombres de chunk en cada arranque), así que esa
  promesa nunca resolvía — ni rechazaba, quedaba pendiente para siempre — y el cierre de sesión
  entero se colgaba en el primer `await`, sin ningún error visible. Ahora chequea
  `navigator.serviceWorker.controller` antes de esperar `.ready`.

## [0.26.0] — 2026-08-05

### Arreglado — el heatmap del calendario ignoraba los filtros activos

- Filtrabas por una categoría, la lista se angostaba, y la grilla seguía pintando el gasto **total**
  de cada día. El color decía "gastaste esto" cuando en realidad decía "gastaste esto en todo": dos
  lecturas distintas en la misma pantalla, y la que engaña es la que se lee de un vistazo.
- La causa era de arquitectura, no de cálculo. El estado de filtros vivía dentro de
  `TransactionsListContent` y el calendario lo dibuja `page.tsx`, que no lo veía. El estado sube al
  ancestro común, junto con el efecto que siembra los prefiltros del deep link (`?category=`,
  `?kind=`, `?pending=`); la lista los recibe por prop y sigue derivando lo suyo.
- El criterio compartido se extrae a **`matchesNonDateFilters`** en vez de duplicarlo: si cada
  punta lo reimplementara, volveríamos exactamente al bug que esto arregla.
- La **fecha** queda deliberadamente afuera del predicado. Es el eje que el propio calendario
  maneja: con el rango aplicado, elegir un día apagaría el resto del mes y la visualización se
  borraría a sí misma.

### Arreglado — las ~20 pantallas que quedaban rotas en modo demo

- Quinto y siguientes casos del patrón que ya rompió Categorías (v0.22.0) y la captura más el modal
  de cuenta nueva (v0.23.0): `useCurrentUserId()` resuelve a `null` **para siempre** cuando no hay
  sesión de Supabase —el modo demo, que nunca crea una—, así que toda pantalla que gatea su render
  con `if (!userId)` se queda en "Cargando…" y toda escritura nunca dispara.
- Barrido completo, 21 archivos: familia (las cuatro), ajustes, perfil, importar, datos,
  notificaciones, home, detalle de cuenta, resumen de tarjeta, recurrentes (las tres), inversiones,
  repartir y editar un movimiento, y `/accounts/new` full-screen.
- **Dos no estaban en la lista y son los más silenciosos**: el materializador de recurrentes, que
  **escribe** y en demo no materializaba ninguna ocurrencia jamás, y `useOwnAccess`, cuya query
  quedaba deshabilitada.
- Quedan **dos** consumidores del hook crudo, a propósito, y son los dos donde la diferencia entre
  "no hay sesión" y "hay una sesión demo" importa de verdad: `onboarding-gate` (con el sustituto
  nunca mandaría a onboarding) y `db-owner-sync` (namespacea la base Dexie por usuario real y tiene
  una rama explícita para `null`).
- **La regla quedó escrita en el docblock de `useEffectiveUserId`**, con esas dos excepciones
  nombradas: si la pantalla escribe, o necesita saber cuál de los miembros del household sos, va el
  hook efectivo. Es el lugar donde alguien la va a leer antes de escribir la sexta pantalla rota —
  que es más valioso que el barrido en sí.

### Cambiado — `pnpm lint` vuelve a ser una señal

- Los 16 errores que lo dejaban en rojo permanente estaban todos en `docs/library/perze-v2.jsx`,
  `docs/design/support.js` y un `_ds_bundle.js`: el bundle del design system y la biblioteca de
  origen, versionados como **referencia** para portar a mano. No son código de la app y no se van a
  arreglar.
- `eslint.config.mjs` ya ignoraba `perze-design/**` con exactamente ese argumento; `docs/` había
  quedado afuera por olvido. Un comando que siempre falla no avisa de nada, que es peor que no
  tenerlo.

## [0.25.0] — 2026-08-05

### Arreglado — la escala del heatmap del calendario aplastaba los días chicos

- Un día con gasto chico se veía **igual que un día sin nada**, y mirando el mes entero casi no
  había diferencia visual entre días. Medido: con la escala anterior, gastos de **80, 40, 20 y 1**
  contra un máximo de 1000 daban **todos exactamente 8%** de mezcla. No se parecían: eran el mismo
  color, y el mismo que el piso.
- **La calibración estaba por debajo del propio diseño.** El piso efectivo era 8% (`Math.max(0.12,
  …)` × 70) contra el **10%** que es el mínimo que dibuja `bloque-d-movimientos.html:457`. Y la
  normalización era lineal contra el máximo del mes, así que un solo día caro empuja a todos los
  demás contra el piso — que es el caso **normal**, no el raro: el gasto diario tiene una
  distribución muy sesgada, pocos días caros y muchos chicos.
- Ahora el piso es 10 y la curva es **raíz cuadrada**, que levanta la zona baja sin perder el
  significado de magnitud (un día más caro siempre pinta más, cosa que un ranking por cuantiles sí
  rompería). Los mismos seis días pasan de `70/28/19/15/12/11` a `70/43/33/27/22/19`.
- **Cero se reserva para "no hubo gasto"**: esa celda queda idéntica al fondo, y eso es
  información, no ausencia de estilo.
- **El techo queda en 70%, y no es una decisión estética.** El número del día vive DENTRO de la
  celda, y los tonos medios no admiten texto chico: medido con la fórmula de luminancia relativa
  WCAG, **entre 80% y 87% de mezcla ninguna tinta llega a 4,5:1**, ni la clara ni la oscura, en
  ninguno de los dos temas. Subir el techo obligaría a invertir la tinta —con el punto de inversión
  **opuesto por tema**, porque en oscuro la celda se aclara al subir la mezcla y en claro se
  oscurece— y además a saltear esa banda, dejando un escalón en una rampa que debe ser continua.
  Verificado en el navegador sobre la celda más intensa real: **5,33:1 en oscuro y 5,58:1 en
  claro**.
- **La leyenda ahora nombra la métrica**: "Menos gasto / Más gasto". El heatmap codifica solo
  gastos, así que un día con un ingreso grande y sin gastos se ve vacío — correcto, pero parecía un
  bug. Es el único lugar de la pantalla donde se puede decir de qué habla el color.
- La escala vive en `calendar-scope.ts` y no inline en el componente porque es la parte testeable,
  y ya se calibró mal una vez. El test de **separación mínima entre días consecutivos** es el que
  falla si alguien vuelve a la escala lineal.
- Fuera de alcance, declarado: el diseño además baja la tinta del número a `--text-secondary` por
  debajo del 30%. No entra — atenuar los días tranquilos trabaja en contra de que se vean, que es
  lo que motivó este cambio.

### Arreglado — un e2e del calendario fallaba de forma intermitente

- El test contaba botones del DOM para verificar que elegir un día angostaba la lista, y la lista
  es **virtualizada**: cuántas filas hay en el DOM depende del scroll y del overscan, no de los
  datos. Pasa a contar **cabeceras de día**, que sí es un ancla estable — el mes entero tiene
  varias, el día elegido tiene exactamente una.
- Tenía además una segunda causa, encontrada en paralelo en la v0.24.0 y conservada al mergear:
  el test entraba por la URL `?view=calendar`, que deja la vista abierta pero **sin `from`/`to`**,
  así que la lista arrancaba con su preset y no con el mes. Ahora entra por el chip, que es quien
  fija el rango. Las dos correcciones son independientes y quedaron las dos.
- Nota de entorno, por si vuelve a aparecer: `playwright.config.ts` usa `reuseExistingServer`, así
  que un `next dev` colgado en el puerto **3100** de una corrida anterior hace que la suite corra
  contra código viejo. Y sin `.env.local` el `webServer` ni arranca (`Invalid environment
  variables`), lo que se manifiesta como timeouts masivos y no como un error de configuración.

## [0.24.0] — 2026-08-05

### Arreglado — entrar con contraseña te devolvía al login

- `signInWithPasswordAction` crea la sesión **en el servidor**, así que el cliente de GoTrue del
  navegador nunca emite `SIGNED_IN`. `useCurrentUserId()` cachea con `staleTime: Infinity` y se
  invalida solo con ese evento: su valor —resuelto al cargar `/login`, sin sesión— quedaba en
  `null` para toda la vida de la página. Con la navegación de cliente que venía después,
  `OnboardingGate` leía ese `null`, concluía que no había sesión y hacía `replace("/login")`.
  Volvías al login, con el formulario vacío, la sesión creada y ni un error que lo explicara.
- La salida del login pasa a ser **navegación de documento** (`window.location.assign`): después
  de un cambio de sesión hay que rearrancar el cliente de Supabase, el cache de TanStack Query y
  el proxy desde las cookies, los tres a la vez.
- `/login` con sesión viva ahora se va a la app. Era una calle sin salida: recargar no cambiaba
  nada y el único escape era escribir la URL a mano.

### Arreglado — el service worker guardaba redirecciones y servía `/login` con sesión válida

- Serwist cachea cualquier respuesta 200, y una redirección seguida **es** un 200: pedir `/` sin
  sesión devolvía, tras seguir el 307 del proxy, el HTML de `/login` con status 200 — guardado
  **bajo la clave `/`**. Después, ya con sesión, alcanzaba con que la red tardara más que
  `networkTimeoutSeconds` para servir ese `/login` cacheado.
- Las tres estrategias de navegación descartan ahora las respuestas redirigidas. Cuidado con el
  detalle de Serwist: el filtro por defecto (200 u opaca) solo se agrega si ningún plugin declara
  `cacheWillUpdate`, así que el nuestro repite esa condición además de la suya.
- `purgeNavigationCaches()` tira los caches de navegación al iniciar sesión: el filtro evita que
  se vuelva a envenenar, pero no desaloja lo que la PWA instalada ya tenía.

### Arreglado — el service worker corría en `next dev` y dejaba la app en blanco

- Con Turbopack los chunks cambian de nombre en cada arranque, así que el precache de la sesión
  anterior servía HTML que apuntaba a archivos inexistentes: pantalla en blanco **sin un solo
  error en consola** —los pedidos se resolvían desde el cache, así que ni siquiera había un chunk
  error que disparara `recoverFromStaleCache()`—. Además el cache es compartido entre worktrees,
  porque para el navegador `localhost` es un solo origen.
- En desarrollo ya no se registra y **se desregistra el que hubiera quedado**, limpiando el Cache
  Storage. `NEXT_PUBLIC_ENABLE_SW_IN_DEV=1` lo enciende para probar offline o instalación local.

### Agregado — `/join`: canjear una invitación es un flujo completo

- Nada en la app linkeaba a `/join`. Ahora J3 copia el link (`/join?invite=CÓDIGO`, que la
  pantalla prellena) y A2 ofrece "tengo un código de invitación" para quien lo recibió dictado.
- El parámetro **no puede llamarse `code`**: `proxy.ts` intercepta cualquier URL con `?code=` como
  canje PKCE de Supabase y la manda a `/auth/callback` antes de que la pantalla renderice.
- El invitado sin cuenta no podía canjear nada (`accept_invite` exige `auth.uid()`) y, si se
  registraba, `resolveOnboardingDestination()` lo mandaba a A4 y **terminaba creando su propio
  hogar**. Ahora el código se guarda (`pending-invite.ts`) y esa misma función lo devuelve a
  `/join` apenas hay sesión.
- La pantalla lleva el wordmark —como A2 y login— y limpia lo que se pega desde un chat: comillas,
  espacios, saltos de línea, minúsculas.

### Arreglado — el email se cargaba con la primera letra en mayúscula

- Cuatro pantallas (A2, login, recuperar contraseña, J3) repetían la misma regex de validación y
  ninguna normalizaba. `useEmailField()` unifica las cuatro: minúscula forzada en el estado y en
  el campo, `autoCapitalize="none"` —`type="email"` no alcanza en Android—, validación por Zod y
  error que propone la corrección al salir del campo.
- No era cosmético: si la invitación lleva email, `accept_invite` la vuelve **nominal** y compara
  contra el de la sesión.

### Agregado — A1 son los tres slides que el diseño prometía

- El mockup dibujaba tres puntos y un solo slide, y el código copió los puntos: un indicador de
  tres páginas que no se podía pasar. Ahora hay tres slides con swipe, el primario dice
  "Siguiente" hasta el último, y el gesto es el que el bloque A declara (24 px horizontales y
  opacidad, 240 ms).
- El título estaba en `t-hero-xl` (64 px) cuando A1 lo especifica en 40 px. Con eso corregido, más
  huecos por `flex-basis` y altura acotada del contenedor, **entra completo en un iPhone SE**
  (375×667) sin scroll y con el primario sobre el pliegue.

### Cambiado — en Movimientos, el detalle y el calendario se turnan

- La segunda columna del split la ganaba siempre el detalle: con un movimiento abierto, tocar el
  chip no mostraba el calendario y no había forma de salir. Pasa a tener **un solo ocupante, y
  gana la última acción explícita**: el chip deselecciona el movimiento, elegir un movimiento
  apaga el calendario, y tocar el movimiento ya abierto lo cierra.
- El rango `from`/`to` no se toca nunca: el día que se venía mirando sigue filtrando la lista.
- La regla de "elegir un movimiento apaga el calendario" es **solo de escritorio**. En móvil no
  compiten —el calendario es contenido arriba de las filas y el detalle abre en un `Modal`— y
  apagarlo sería sacarle al usuario el mes que estaba recorriendo.

### Arreglado — texto en español con la app en inglés

- Grupo familiar mostraba "Vos" en tu propia fila. No era una string de UI: `completeOnboarding()`
  escribía ese literal en `household_members.display_name`, que además es **lo que ven los demás**
  — tu pareja te iba a ver listado como "Vos". Ahora se guarda el nombre real del registro, y tu
  propia fila se rotula con el idioma de la app.
- La preview de plantillas de categorías imprimía el `name` en español, que es el fallback que se
  persiste, no lo que se muestra. Traduce por `i18nKey`, igual que `useCategoryLabel()`. De paso
  `CategoryTemplateItem.i18nKey` pasó de `string` a la unión de claves reales: agregar un ítem sin
  su mensaje ya no compila.

### Arreglado — tests de la vista de calendario que fallaban antes de este cambio

- Dos contaban botones apenas terminaba el `goto`, antes de que la lista renderizara. Uno daba 0;
  el otro fallaba por una fila porque navegar a `?view=calendar` a mano deja la vista abierta pero
  **sin** `from`/`to` —es `openCalendar()` quien fija el rango—, así que "volver al mes entero"
  comparaba contra otro conjunto de filas.

## [0.23.0] — 2026-08-05

### Arreglado — en modo demo no se podía cargar un gasto

- `CaptureFlow` gatea su render con `if (!household || !userId)` usando `useCurrentUserId()`, y ese
  hook resuelve a `null` **para siempre** cuando no hay sesión de Supabase — el caso del modo demo,
  que nunca crea una. La pantalla de captura quedaba en **"Cargando…"** eternamente: en demo era
  imposible cargar un gasto, que es la única métrica por la que se juzga esta app. Pasa a
  `useEffectiveUserId()`.
- Mismo bug en `@modal/(.)accounts/new`, que además hacía `return null`: se abría la URL del modal
  y no se dibujaba nada.
- Es el tercer y cuarto caso del mismo patrón (el primero fue Categorías, en la v0.22.0). **Quedan
  ~13 pantallas más usando `useCurrentUserId()`**, varias de ellas de escritura: familia, ajustes,
  perfil, importar, datos, notificaciones, detalle de cuenta, resumen de tarjeta, recurrentes,
  inversiones, repartir un movimiento, editar un movimiento y `/accounts/new` full-screen. No se
  tocaron en este cambio, pero hay que revisarlas una por una: `useCurrentUserId()` es correcto
  solo donde se necesita la sesión REAL (`OnboardingGate`, `DbOwnerSync`).

### Agregado — el riesgo de "portal huérfano" queda cubierto por un test

- `docs/auditoria-rutas-interceptoras.md` § 4 advertía que un `Modal` portaleado a `document.body`
  podía sobrevivir a un "volver" y tapar la pantalla entera, porque con `cacheComponents: true`
  `Activity` oculta su propio subárbol pero no lo que ese subárbol portaleó afuera. Estaba
  verificado solo en escritorio.
- `e2e/modal-portal-orphan.spec.ts` lo cubre ahora en **mobile** para las dos rutas interceptoras
  que quedan. **El overlay no sobrevive en ninguna de las dos.** La aserción fuerte no es que el
  contenido desaparezca sino que la pantalla de abajo reciba eventos de puntero: un `click` de
  Playwright falla si otro elemento los intercepta, que es lo que haría un overlay huérfano aunque
  fuera invisible.
- Los dos modales se comportan distinto y los dos están bien: al volver, `/add` desmonta su
  subárbol y `/accounts/new` lo deja montado pero oculto. Por eso el test afirma `toBeHidden()` y
  no `toHaveCount(0)` — exigir que desaparezca del DOM sería fijar un detalle de implementación.

## [0.22.0] — 2026-08-05

### Arreglado — Categorías no renderizaba nada en modo demo

- `/more/categories` usaba `useCurrentUserId()` en su barrera de carga, y ese hook resuelve a
  `null` **para siempre** cuando no hay sesión de Supabase — que es exactamente el caso del modo
  demo, que nunca crea una. La pantalla quedaba en skeleton eternamente. Ahora usa
  `useEffectiveUserId()`, que es el hook que `use-current-user.ts` documenta para las pantallas
  que ESCRIBEN, y esta crea, edita, archiva y borra categorías.
- Está así desde la v0.3.0. No se detectó antes porque el e2e que lo cubre venía sin ejecutarse
  (ver abajo).

### Arreglado — la suite de e2e de navegación llevaba mucho tiempo sin correr entera

- `navigation-replace.spec.ts` tenía **1 test fallando y 11 que nunca llegaban a ejecutarse**: el
  `describe` es serial, así que el primer fallo dejaba a todos los siguientes en `skipped` o
  `did not run`. El id del test fallado coincide con el registrado el 4 de agosto, o sea que la
  falla es anterior a los cambios de navegación de las v0.18–v0.20. Ahora **pasan los 8** que no
  están explícitamente en `skip`.
- **La causa raíz era una aserción mal ubicada, no la app.** Diez comprobaciones de toast estaban
  escritas DESPUÉS de `expectReplaceNotPush`, que termina con un `goBack()`: para cuando esa
  navegación termina, el toast ya expiró. La traza lo confirmó — el toast se renderizaba y
  desaparecía antes de que la aserción lo buscara. Las otras nueve pasaban por llegar a tiempo,
  no por estar bien. El helper gana un parámetro `afterSave` que corre en el momento correcto.
- Tres tests asumían seguir parados en el detalle o la lista después de llamar al helper, que
  deja la página una entrada más atrás en el historial.
- El de editar un movimiento esperaba aterrizar en `/transactions`; el editor hace `router.back()`
  y desde que el detalle es un search param vuelve a `/transactions?tx=<id>`. Su comentario decía
  lo contrario y también se corrigió.
- `categories-manage.spec.ts` se actualizó al copy nuevo ("Archivar categoría", que antes decía
  "Borrar categoría" sin borrar) y a que archivar ya no hace desaparecer la categoría de la
  pantalla sino que la baja a "Archivadas".

## [0.21.0] — 2026-08-05

### Cambiado — el calendario dejó de ser una pantalla y pasó a ser una vista de Movimientos

- **`/transactions/calendar` era una ruta que el diseño nunca pidió.**
  `docs/design/bloque-d-movimientos.html` dibuja D5 con el `AppHeader` de Movimientos, **sin botón
  de volver**, y un toggle de vista. Se había programado como pantalla propia, con su header y su
  back: tocar un chip costaba una navegación de ruta entera.
- **Y la pantalla duplicaba lo que ya existía.** Reimplementaba la lista virtualizada, el
  `TransactionsSummaryStrip`, el `NeedsFxBanner`, las cabeceras por día y los estados vacíos. La
  copia además era **peor que el original**: sin swipe, sin selección múltiple, sin etiquetas en el
  `meta`, sin `syncIssue` y sin el resalte de la fila abierta.
- Ahora es **`?view=calendar`** sobre `/transactions`. Elegir un día no abre nada: escribe
  `from`/`to`, los mismos search params que ya gobernaban el rango de la lista, y la única lista se
  angosta. El resumen ya se calculaba solo por rango de fecha, así que los totales del día salieron
  sin escribir una línea.
- **El alcance no tiene estado propio.** Mes visible y día elegido se **derivan** de `from`/`to`
  (`features/movements/calendar-scope.ts`), así que la grilla no puede desincronizarse de lo que la
  lista muestra. `use-calendar-view.ts` es el único lugar que traduce entre URL y alcance, y lo
  comparten el contenedor y la lista.
- **En escritorio el calendario ocupa la segunda columna**, la misma que el detalle. Con `?tx=`
  abierto gana el detalle, y volver restaura el calendario con el día todavía elegido porque el
  param nunca se pierde. Las columnas pasaron de `minmax(340px,420px)` a `minmax(360px,560px)`:
  ~54/46 a 1280 y ~60/40 a 1440, y la derecha deja de crecer más arriba. El techo de lectura de
  420px se mudó del grid al contenido del detalle — si la geometría dependiera del ocupante, la
  columna daría un salto de ancho justo al abrir un movimiento.
- Del diseño entran cuatro cosas que faltaban: **semana de lunes a domingo**, **leyenda de
  intensidad** (un heatmap sin escala no se puede leer), **días futuros atenuados y `disabled` de
  verdad** —elegirlos siempre daba una lista vacía, o sea era una interacción sin salida— y el
  **conteo de movimientos** en la cabecera del día, solo con el calendario abierto. El día elegido
  va con `--selection-surface` + `--selection-ring` y no con el relleno solo que pide el diseño: la
  auditoría midió eso en 1,065:1 en modo claro.
- La ruta vieja queda como **redirect de servidor**: el chip la abría con `push`, así que hay
  historial real en cualquier PWA instalada y un 404 ahí sería una regresión.
- Queda una divergencia declarada: el diseño pide un `SegmentedControl ['Lista','Calendario']` y
  quedó el chip toggle, porque con la lista visible debajo un segmentado que dice "Calendario" es
  engañoso. Registrada en `docs/plan-de-trabajo.md` (CONS-D05), junto con la deuda de `MonthCalendar`
  **invertida**: hay que subir el componente de biblioteca al contrato de D5, no bajar la pantalla.

### Arreglado — en un iPhone SE la lista de movimientos del calendario no se veía

- El calendario era fijo en los dos layouts y la lista se quedaba con la altura sobrante, que en un
  teléfono chico es **cero**: a 568px de alto, menos 56 de header y 64 de tab bar quedan ~448, y el
  mes solo ya mide ~400px. El panel arrancaba con ~48px útiles.
- **No se arreglaba achicando el mes**: cualquier techo que deje lugar a tres filas de lista pone
  las celdas por debajo del mínimo táctil de 44px. El calendario no es un encabezado fijo, es
  contenido — así que en móvil scrollea junto con la lista. Lo que queda pegado es la franja de
  totales, que es una línea y sobrevive a cualquier alto.
- Esto corrige la línea de la 0.19.0 que decía que "en los dos layouts el calendario queda fijo":
  dejó de ser cierto en móvil.
- Consecuencia para el virtualizador: la lista ya no arranca en el origen del scroller, así que esa
  distancia se **mide** contra el DOM y se le pasa como `scrollMargin`, con un `ResizeObserver` que
  la recalcula al rotar y al cambiar de mes. Se mide en vez de calcularse porque depende del ancho
  del teléfono (las celdas son cuadradas), de cuántas filas tenga el mes y de si hay banner.
- El aire superior va en el wrapper del calendario y no como `paddingTop` del scroller: Chrome ancla
  los `sticky` al borde del content box, y ese padding bajaba la franja de totales dejando una
  banda transparente por la que se veían pasar las filas.
- El despeje del FAB se mudó adentro del scroller. Con el padding afuera, las filas aparecían y
  desaparecían contra una línea varios píxeles por encima del tab bar — se leía como una banda
  opaca pegada abajo.
- La barra de scroll quedaba pegada al texto y al calendario. Se ensancha la caja de scroll hasta el
  borde de la pantalla con `marginInline` negativo y el mismo valor de vuelta como padding: el borde
  del contenido no se mueve ni un píxel.
- El chip de alcance decía "miércoles, 5 de agosto", se partía en dos renglones y quedaba más alto
  que los chips de al lado. Va abreviado —"mar, 4 ago" · "Wed, Aug 5" · "qua., 5 de ago."— vía un
  `formatDateMedium` nuevo, que deja la abreviatura en manos de `Intl` porque cada idioma corta
  distinto y cambia el orden de los campos.

### Arreglado — dos bugs de fecha que el refactor destapó

- **Los límites de rango se arman con medianoche LOCAL serializada a UTC**, la misma receta que ya
  usaba `periodStartFor`, que se mudó al mismo módulo para que las dos no puedan divergir. Un
  `${iso}T00:00:00Z` —lo natural de escribir— habría corrido los días tres horas en UTC−3. Hay un
  test que compara las dos recetas.
- **La suite pasó a correr con `TZ=America/Montevideo`.** Sin eso, en una CI en UTC ese test pasa
  sin probar nada: ahí los dos strings coinciden.
- **Las cabeceras por día agrupaban con `occurredAt.slice(0, 10)`, que es el día en UTC.** Un
  movimiento de la noche caía en el día siguiente. Era invisible mientras el calendario tenía su
  propia lista, porque agrupaba y filtraba con el mismo criterio equivocado; al pasar a filtrar por
  rango local, el heatmap habría contado un día y la lista mostrado otro. Va por `dayKeyOf`.

### Nota de implementación — la transición del panel

- Meter los tres estados de la segunda columna (vacío, calendario, detalle) en el mismo
  `AnimatePresence mode="wait"` lo deja **trabado**: la salida del estado vacío no resuelve nunca y
  el hijo nuevo no llega a montarse, así que el calendario no aparecía. El `transitionKey` de
  `DetailPanelTransition` cambia ahora solo cuando cambia el **detalle**, y el calendario entra con
  `PageEnter`, que es exactamente animación de montaje.

## [0.20.0] — 2026-08-05

### Agregado — las categorías se pueden borrar, y las archivadas se pueden recuperar

- **Archivar dejó de ser un borrado irreversible disfrazado.** `restoreMany` estaba cableado
  únicamente al "Deshacer" del toast, así que apenas ese toast se iba no quedaba ninguna pantalla
  desde donde recuperar la categoría — justo lo contrario de lo que promete la nota de esa
  pantalla. Ahora hay una sección **"Archivadas"** al final del árbol, espejando la de
  `/accounts`, y un tap revive.
- **Y el botón decía lo que no hacía.** Era "Borrar categoría" en rojo, pero llamaba a
  `archiveWithChildren()`: ponía `archivedAt` y no borraba nada. La app se contradecía sola — el
  toast que salía después ya decía "archivada". Ahora dice **"Archivar categoría"** y es
  `secondary`, porque es reversible. Se renombraron también las claves que mentían
  (`deleteCategory` → `archiveCategory`, `categoryDeleted` → `categoryArchived`).
- **Borrado de verdad, con la regla escrita en pantalla.** Debajo del botón siempre se lee el
  criterio; cuando algo bloquea, el texto nombra QUÉ lo bloquea ("No se puede borrar: 4
  movimientos") para saber dónde ir a soltarlo.
- **El criterio no es "0 movimientos", aunque así se pidió.** Una categoría se referencia desde
  **seis** tablas, no una: transacciones, **repartos**, presupuestos, recurrentes, reglas de
  auto-categorización y el comercio por defecto. La lista sale de `reassignAllReferences`
  (`merge-duplicate-categories.ts`), que ya era la autoritativa del repo. El caso que obliga a
  mirar más allá de las transacciones es `transaction_splits.categoryId`, que **no admite null**:
  un reparto cuya categoría se borró no se puede renderizar ni reparar desde la interfaz.
- **Borrar arrastra a las subcategorías, y se avisa antes.** Tener hijas no bloquea; bloquea que
  alguna de ellas tenga algo asociado. El subárbol se borra de **hoja a raíz**, así que en ningún
  instante queda una hija colgando de una madre que ya no está.
- **Las archivadas se muestran anidadas.** Eran una lista plana, y con duplicados era imposible
  saber de cuál "Salud" colgaba cada "Farmacia" — la archivada o la activa. Una archivada cuya
  madre no lo está aparece al primer nivel diciendo de quién viene.
- `categoriesRepo.list()` no filtraba `deletedAt`. Nadie lo había notado porque hasta ahora nada
  escribía esa columna para categorías.

### Agregado — las reglas de auto-categorización se editan y se borran

- La fila de la lista no era tocable: una regla mal escrita no se podía corregir ni sacar, solo
  apagar con el switch — y apagada seguía ocupando la lista igual. Ahora abre un editor en
  `/more/rules/[id]/edit`.
- Borrar no pregunta: ejecuta, vuelve a la lista y ofrece **Deshacer**, que es el patrón por
  defecto del proyecto.
- El formulario se extrajo a **`RuleForm`**, compartido entre crear y editar, en vez de duplicar
  el segmentado, el sheet de categorías y la validación en dos archivos.
- **`archive()` de este repo tampoco archivaba**: ponía `deletedAt`, que `list()` filtra, y no
  existe ninguna pantalla de reglas archivadas. Como no tenía callers, pasó a llamarse `remove()`,
  con un `restore()` para el deshacer.
- El `update()` de reglas fallaba en silencio con el mismo `if (!existing) return;` que se corrigió
  en cuentas. Ahora lanza.

### Arreglado — el índice de uso quedaba desfasado y bloqueaba borrados válidos

- Borrabas una categoría archivada y la siguiente aparecía bloqueada por subcategorías que ya no
  existían, hasta recargar la página. **No era el caché de Next**: las categorías viven en Dexie y
  TanStack Query, que ese toggle no toca; el reload lo tapaba porque reconstruye el estado desde
  la base.
- La causa: seis de las siete fuentes se leían frescas de Dexie dentro del cálculo, y la séptima
  —la lista de categorías, que alimenta el conteo de subcategorías— llegaba por parámetro desde el
  estado de React. Al borrar se invalidan las dos queries a la vez y el índice se recalculaba con
  el array del render anterior, que todavía tenía adentro lo recién borrado.
- Ahora **las siete se leen en la misma pasada**, así que el índice es consistente consigo mismo
  por construcción. Cubierto por una regresión explícita.
- Como efecto colateral de ese bug pueden haber quedado subcategorías archivadas cuya madre fue
  borrada. Aparecen al primer nivel de "Archivadas" y se borran normalmente; no se tocan solas.

### Cambiado — "Nueva categoría" deja de ser un botón al pie

- En escritorio quedaba tan abajo que había que scrollear la pantalla entera para llegar. Pasa a
  ser la **última fila de la lista**, con el mismo `ListRow` de variante `action` que ya usaban
  `/more/tags` y `/more/rules` — las tres pantallas de gestión quedan parejas. Al dejar de ser un
  botón primario, además, no hay conflicto con la regla de que el primario vive en los últimos
  200px de la pantalla.

## [0.19.0] — 2026-08-05

### Cambiado — el calendario muestra el mes entero, no solo el día que elijas

- Entrar a `/transactions/calendar` **no mostraba ningún movimiento**: el panel solo existía con
  un día seleccionado. Ahora arranca con el mes visible completo y se angosta al día que se
  toque; el chip "Todo el mes" —o volver a tocar el mismo día— devuelve al mes.
- **La grilla tiene un techo propio de 400px.** Las celdas son cuadradas (`aspectRatio: "1"`), así
  que heredar el ancho del shell (1200px) hacía que el mes creciera de **alto**: cada día medía
  ~162px y el calendario pasaba de 1000px, o sea que había que scrollear para ver un mes entero.
- En los dos layouts el calendario queda **fijo** y el único scroller vertical es la lista: en
  escritorio como columna derecha, en móvil como bloque de abajo. Un solo scroller es además lo
  que permite virtualizar la lista sin ramificar el código.
- El corte a dos columnas usa `DESKTOP_BREAKPOINT` (1024px) y no el `SPLIT_BREAKPOINT` de
  `/transactions`: ese umbral más ancho existe porque allá la lista de la izquierda tiene que ser
  legible, y acá la izquierda está topeada en 400px.
- **Los totales excluyen los movimientos sin cotización** y declaran el conteo con
  `NeedsFxBanner`, en vez de sumarlos como si valieran cero.
- Dos correcciones de fecha que ya habían mordido antes: `todayIso()` en lugar de
  `new Date().toISOString().slice(0, 10)` —que adelanta el día entre las 21:00 y la medianoche en
  cualquier huso negativo— y un helper `noonUtc()` para los días sintetizados en el cliente, por
  la misma razón.
- El header pasa a registrarse con `usePageHeader` y su "volver" usa `push`, no `back()`: al
  calendario se llega desde el chip de `/transactions` pero también por deep link con el historial
  vacío.
- Se extrajo **`TransactionsSummaryStrip`** (Ingresos · Gastos · Balance), que vivía inline en la
  lista de movimientos, al aparecer este segundo consumidor.

### Cambiado — la navegación de escritorio deja de scrollear

- Con varios módulos encendidos el sidebar no entraba en pantalla: **21 entradas** entre los
  primarios, DINERO, PERSONAS, los siete destinos de SISTEMA y "Más", más de 1100px de alto.
- **SISTEMA colapsa en una sola entrada.** Perfil, Seguridad, Notificaciones, Estado de
  sincronización, Ajustes, Datos y backup y Acerca de son configuración que se visita de vez en
  cuando, y desplegados ocupaban un tercio del panel. Se llega a los siete por `/more`.
- **Desaparece "Más" del sidebar**, porque apuntaba al mismo `/more`. En escritorio esa página era
  una copia de lo que el sidebar ya muestra al costado; en móvil sigue siendo el 5º tab y la
  única puerta a todo, así que ahí no cambia nada.
- Resultado: **14 entradas**, sin scroll (medido: `scrollHeight` = `clientHeight`).
- `/more` se adapta: en escritorio muestra solo el bloque Sistema —con **Panel del operador
  adentro de la tarjeta**, no suelto abajo— y el header dice "Sistema". La columna que queda
  libre la llena el `ZMark`, con la versión debajo: antes esa línea se centraba respecto del grid
  entero y quedaba descentrada respecto de lo único visible.
- Se agrega el ícono `gear` al set (`GearSix` de Phosphor: a 20px los seis dientes se leen y los
  ocho del otro se empastan). No aparece como ícono elegible para una categoría, que usa su
  propia lista curada.

### Agregado — la lista de movimientos resalta el que estás viendo

- Con el detalle en la columna de al lado no había ninguna señal de qué fila estaba abierta.
  Ahora la fila seleccionada lleva el par canónico del sistema: `--selection-surface` más anillo
  `--selection-ring`, el mismo que `SegmentedControl`, `DateStrip`, `OptionCard` y las tarjetas de
  `/accounts`. Nada de violeta, que está reservado a la acción primaria.
- El resalte **sangra 12px hacia cada lado sin mover el contenido**: la caja crece contra el
  `--screen-padding` y el texto queda en el mismo píxel que el de las demás filas. Sin eso el
  anillo pasaba justo por el borde del ícono y del monto.
- Vive por detrás de `SwipeableRow` y no adentro, porque ese componente tiene `overflow: hidden`
  y lo recortaría. De paso es lo correcto durante el swipe: la fila es transparente en reposo y
  solo se vuelve opaca mientras se arrastra, así que se despega del resalte con el gesto.
- Lleva `aria-current` para no depender solo del color, y **no se dibuja durante la selección
  múltiple**: ahí manda el checkbox, y dos lenguajes de selección a la vez se leen como "esta fila
  también está tildada".
- El `AccountCard` compacto de `/accounts` recupera el anillo que solo tenía su variante de
  escritorio: la superficie sola da 1,24:1 en modo claro, que es el defecto 2 de la auditoría
  visual.

## [0.18.1] — 2026-08-05

### Arreglado — tres cosas que fallaban sin hacer ruido

- **Archivar una cuenta que no está en Dexie ya no resuelve con éxito.** `enqueueAccountUpdate`
  hacía `if (!existing) return;`, así que la operación terminaba bien sin escribir ni encolar
  nada: la UI mostraba el toast de "archivada", la cuenta seguía ahí, y no quedaba rastro en
  ningún lado. Ahora lanza, igual que ya hacía `applyBalanceDelta`. Todos los call sites pasan el
  id de una fila que acaban de leer, así que no encontrarla es un error de verdad y no un caso
  esperado.
- **El header de página dejó de re-renderizar el shell entero en cada render de cada pantalla.**
  `usePageHeader` llama al `setState` del layout con un objeto nuevo en cada render; que eso no
  terminara en "Maximum update depth exceeded" dependía de un bail-out de React, y un wrapper sin
  `useMemo` en el medio alcanzaba para romperlo. El proveedor ahora descarta lo que es equivalente
  a lo que ya tenía, y el `onBack` que recibe tiene identidad estable.
- **El efecto sin dependencias se dejó como estaba, a propósito.** Es load-bearing y no era obvio:
  en el master-detail de escritorio hay dos consumidores montados a la vez, y lo único que
  devuelve el header a su estado de lista cuando el detalle se desmonta es que la lista vuelva a
  registrarse en el render siguiente. Con un array de dependencias quedaría el botón de volver de
  un detalle que ya no existe.
- **Las dos recargas automáticas del service worker ahora dejan rastro en la consola.** La app
  tenía un segundo camino por el que podía recargarse sola —borrando todo el Cache Storage— ante
  cualquier error que pareciera un chunk que no carga. Es un mecanismo de recuperación legítimo
  para un deploy nuevo, pero sin log era indistinguible de un bug. El mensaje que lo disparó queda
  registrado, así que si algún día lo activa un import dinámico que falla por otra razón, se ve.
  El patrón de match se dejó igual: la queja era la falta de rastro, no que matcheara de más.

### Documentación

- `docs/auditoria-rutas-interceptoras.md` queda cerrado. Se sumó la **decisión sobre las dos rutas
  interceptoras que siguen vivas: las dos se quedan.** El argumento para tocarlas era que
  acumulaban y forzaban recargas, y la medición no lo sostuvo. `(.)accounts/new` era el candidato
  a eliminar, pero sacarlo cambiaría crear una cuenta de modal sobre la lista a pantalla completa:
  pagar en experiencia por un beneficio que no existe. Queda anotado lo único sin verificar — el
  riesgo de portal huérfano en mobile.

## [0.18.0] — 2026-08-05

### Cambiado — el detalle de movimiento pasa a search param, como ya lo había hecho el de cuenta

- `/transactions/<id>` deja de ser una ruta y pasa a ser una selección dentro de la lista:
  **`/transactions?tx=<id>`**. Es la gemela de lo que v0.17.0 hizo con cuentas, y se hizo por el
  mismo motivo de producto: pasar de un movimiento a otro **es la misma pantalla**, y hacerlo
  pasar por una navegación de ruta desmontaba el layout y remontaba el detalle para cambiar una
  sola columna. Eso se veía como un parpadeo en cada cambio de registro.
- Como efecto colateral desaparece la ruta interceptora, que es la que sufría el bug abierto de
  Next ([#91265](https://github.com/vercel/next.js/issues/91265)) por el que en desarrollo se
  acumula un marcador `(.)` hasta que el server tira `Invalid interception route` y fuerza una
  recarga completa de página.
- **Se borraron `transactions/layout.tsx` (96 líneas) y todo `transactions/@detail/`**: el
  interceptor, el `default.tsx` obligatorio del slot paralelo y el archivo de especificidad que
  existía solo para que el interceptor no reclamara `"calendar"` como si fuera un id de
  movimiento. Con ellos se va la detección vieja de hard-nav (`initialPathname` congelado), que
  hacía que al abrir un segundo movimiento el detalle se dibujara en la columna de la lista.
- **El botón "Calendario" vuelve a ser una navegación blanda.** Era `window.location.href`, o sea
  una recarga dura de documento puesta a propósito para esquivar al interceptor. Sin interceptor
  no hay nada que esquivar.
- **Al abrir un movimiento se conservan los filtros de la URL.** La lista recibe `?kind=`,
  `?from=`, `?to=` y `?pending=` desde el home, y `?category=` y `?payee=` desde el buscador;
  ahora el id se suma a los que ya estaban en vez de reemplazarlos, así que la lista de atrás
  mantiene su filtro y cerrar el detalle no devuelve a una lista sin filtrar.
- `/transactions/<id>` sigue viva como **redirect de compatibilidad** — hay una PWA instalada con
  historial largo y un 404 ahí sería una regresión real. Editar y repartir siguen siendo rutas
  propias (`/transactions/<id>/edit`, `/split`): son pantallas completas, no una selección.

### Agregado — transiciones de motion en el panel de detalle y en la entrada del dashboard

- **`DetailPanelTransition`** — al cambiar de registro, la columna de detalle funde y se desplaza
  en vez de reemplazarse de golpe. Con el search param el cambio es instantáneo, y sin nada que
  lo acompañe se leía como un salto. Va en `/transactions` y en `/accounts`.
- Usa `mode="wait"` (el panel saliente se va antes de que entre el nuevo) porque superponerlos en
  el mismo track del grid hacía que la columna diera un estirón a mitad de camino, ya que el
  detalle de dos registros rara vez mide lo mismo de alto. La salida es un tween de 120 ms y la
  entrada un spring `default`; el total queda por debajo del techo de 320 ms.
- **`PageEnter`** — entrada suave del dashboard: funde y sube 10 px una sola vez, al montarse.
  Usa `spring.soft`, que es la curva declarada para "sheets, pantallas". **No es intercambiable
  con `DetailPanelTransition`**, que lleva `initial={false}` y justamente no anima en el primer
  render. Envuelve el retorno con datos y no los estados de carga, así el gesto ocurre cuando el
  contenido reemplaza al skeleton en vez de animar dos veces.
- Los dos respetan el ajuste propio de intensidad además de `prefers-reduced-motion`: en
  "Reducida" solo funden, sin desplazamiento, y en "Mínima" no animan. Los dos entraron en
  `/dev/components`.

### Documentación

- **`CLAUDE.md` gana la regla que faltaba**: un master-detail se hace con search param, nunca con
  slot paralelo más ruta interceptora, con la receta de siete pasos y los seis pares pendientes
  de CONS-DESK nombrados (metas, presupuestos, recurrentes, deudas, familia, inversiones). El
  patrón viejo se venía copiando de `accounts/` y `transactions/`, que eran los dos ejemplos
  vivos; ahora no queda ninguno del que copiarlo mal.
- **`docs/auditoria-rutas-interceptoras.md` se actualizó con la medición.** El resultado corrige
  al propio documento: **61 recompiles de HMR con ~90 navegaciones por rutas interceptoras dieron
  cero errores**, así que el bug de Next es real pero **no se reproduce a pedido**, y el modelo de
  "cada guardado suma un marcador" no se sostiene. Queda anotada la hipótesis vigente —que la
  acumulación la dispara mutar el árbol de rutas, no editar el contenido de un archivo— y sin
  verificar.

## [0.17.1] — 2026-08-05

### Cambiado — cada subcategoría deja de heredar el ícono genérico de su padre

- En la plantilla "Completa", las nueve subcategorías arrancaban con el glifo del padre
  (`shopping-cart` para las tres de supermercado, `car` para las tres de transporte,
  `heart-pulse` para las tres de salud). En la lista de categorías las tres hijas se veían
  idénticas entre sí y también idénticas al padre, así que el ícono no aportaba nada para
  distinguirlas: **Verdulería** → `carrot`, **Carnicería** → `cow`, **Almacén** → `basket`,
  **Transporte público** → `bus`, **Estacionamiento** → `letter-circle-p`, **Consultas** →
  `stethoscope`, **Seguro médico** → `shield`.
- Cuatro categorías de primer nivel tenían un ícono directamente equivocado, heredado de cuando
  el set no tenía alternativa: **Ropa** (`tag` → `shirt`), **Educación** (`briefcase` →
  `graduation`), **Mascotas** (`heart-pulse` → `paw`) y **Regalos** (`handshake` → `gift`).
- Esto cambia **solo los defaults de plantilla**, o sea lo que se aplica al crear un household
  nuevo. Las categorías existentes guardan su `icon` en la fila, así que las que ya se editaron
  a mano no se tocan y las que no, siguen con el ícono viejo hasta que se editen.

### Agregado — el picker de íconos de categorías pasa de 61 a 104 glifos

- El set venía dimensionado para el *chrome* de la app, no para categorías, así que había rubros
  enteros que no tenían glifo y terminaban en `tag` o `briefcase`. Los huecos más notorios que
  quedan cubiertos: **impuestos, suscripciones/streaming, internet, expensas, limpieza, peaje,
  delivery, terapia y donaciones**.
- Los 43 nuevos, por grupo — Comida: `bread`, `fish`, `ice-cream`, `bowl-food`, `wine`, `cake`.
  Transporte: `taxi`, `motorcycle`, `road`, `globe`. Casa y servicios: `building`, `broom`,
  `washing-machine`, `plant`, `wifi`, `toolbox`. Salud: `pill`, `syringe`, `brain`, `hospital`.
  Ocio: `monitor-play`, `guitar`, `confetti`, `tent`, `mountains`, `running`, `camera`. Compras:
  `sneaker`, `bag`, `watch`, `laptop`, `smartphone`. Plata: `vault`, `percent`, `calculator`,
  `invoice`, `invest`. Otros: `scales`, `gavel`, `hand-heart`, `dog`, `cat`, `cloud`.
- Ocho de esos ya existían en `ICONS` y nunca se habían ofrecido en el picker (`building`,
  `wifi`, `toolbox`, `globe`, `camera`, `smartphone`, `scales`, `invest`); los otros 35 son
  imports nuevos de Phosphor. `bone` se sumó como alternativa a `cow` para carnicería.
- Todos con su clave `reference.icon.*` traducida a ES/EN/PT, que es lo que alimenta el buscador
  del picker y el `aria-label` de cada botón: se busca por rubro ("peaje", "streaming",
  "donaciones"), no por el nombre del glifo en inglés.
- **`letter-circle-p` para estacionamiento no es un capricho**: Phosphor no tiene glifo de
  parking, y la P en círculo es la señalética universal.
- La grilla es `auto-fill` con scroll, así que los 104 entran sin tocar el layout del sheet.

---

## [0.17.0] — 2026-08-05

### Cambiado — el detalle de cuenta deja de ser una ruta y pasa a ser un search param

- **`/accounts/[id]` → `/accounts?account=<id>`.** El detalle de cuenta era una ruta
  interceptada por un slot paralelo (`accounts/@detail/(.)[id]`). Eso disparaba un bug abierto de
  Next.js 16 ([vercel/next.js#91265](https://github.com/vercel/next.js/issues/91265)): las rutas
  interceptoras acumulan un marcador `(.)` **en cada actualización de HMR**, sin limpiar las
  anteriores. Tras un rato de desarrollo la ruta quedaba como `/accounts/(.)(.)…(.)<uuid>`, el
  server tiraba `Invalid interception route` y Next forzaba una recarga completa de página. Medido
  sobre un log real de ~5 h: **45 errores, 44 de ellos seguidos de recarga en menos de un segundo,
  y 26 recargas encadenadas** en ráfagas de 3–4. Eso era el "loading en loop del que no se sale" y
  el "golpe" de UI al cambiar de cuenta — no era una transición mal animada, era una recarga real
  de documento. **Es solo en desarrollo** (HMR/Turbopack); producción nunca estuvo afectada.
- **Sin ruta interceptora no hay nada que acumule marcadores**, así que el bug deja de aplicar por
  construcción y no por parche. Se borraron los 4 archivos del slot `@detail` (incluidos
  `new/page.tsx` y `resolve-fx/page.tsx`, que eran puros hacks de especificidad para que el
  interceptor no reclamara `"new"` o `"resolve-fx"` como si fueran un id de cuenta) y
  `accounts/layout.tsx` entero, cuyas ~100 líneas eran todas compensación de rarezas de
  interceptación. Neto en `accounts/`: **−503 líneas, +162**.
- **De paso, seleccionar una cuenta dejó de ser una navegación de ruta**: la lista ya no se
  desmonta, conserva su scroll (`{ scroll: false }`) y solo cambia la columna de detalle. El
  detalle se abre con `push` —para que el botón atrás del navegador y el de Android lo cierren,
  que es el gesto esperado en una PWA— y se cierra siempre con `router.back()`.
- **Cierra además un bug latente de portal huérfano**: el detalle interceptado se dibujaba dentro
  de `<Modal>`, que hace `createPortal` a `document.body`. Con `cacheComponents: true`,
  `router.back()` no desmonta una pantalla de ruta —la deja oculta en modo `Activity`— y `Activity`
  **no puede ocultar contenido portaleado**, así que el overlay opaco podía sobrevivir tapando la
  pantalla entera. Ahora el modal es un render condicional común dentro de la misma ruta.
- `/accounts/<id>` sigue vivo como redirect de compatibilidad: hay una PWA instalada con historial
  largo y un 404 ahí sería una regresión real.

### Corregido — "volver" necesitaba dos toques en ~16 pantallas

- Al guardar, archivar, borrar, conciliar o dividir, las pantallas hacían
  `router.replace(urlDeLaLista)`. Pero esa URL **ya estaba justo debajo en el historial** (se había
  llegado con un `push` desde ahí), así que `replace` no evitaba la entrada: la **duplicaba**. El
  historial quedaba `[lista, lista]` y el primer "volver" caía en el duplicado, indistinguible de
  "no pasó nada"; recién el segundo salía de verdad. Reportado en recurrentes y confirmado por
  construcción en los ~16 sitios que compartían el patrón.
- Reemplazado por `router.back()`, que recorre el historial existente sin agregar nada, en cuentas,
  metas, presupuestos, deudas, reglas, inversiones, movimientos y recurrentes.
- **Como efecto secundario, dos flujos mejoraron solos**: editar un movimiento ahora vuelve al
  detalle del que se venía en vez de saltar siempre a la lista, y crear un instrumento como
  sub-paso de una operación vuelve a la operación que se estaba llenando en vez de a una vacía
  (esto último estaba anotado como "limitación aceptada").

### Corregido — editar una conciliación la convertía en un gasto, en silencio

- El detalle de movimiento ofrecía "Editar" para cualquier `kind`, incluidas las conciliaciones
  (`kind === "adjustment"`). `EditTransactionFlow` no sabe representarlas: las cargaba como
  `expense`, exigía elegir una categoría (una conciliación no tiene) y, si se guardaba,
  **persistía el cambio de tipo de forma permanente**. El ajuste dejaba de excluirse de los
  agregados que hoy lo tratan aparte (resumen del período, flujo de dinero, ciclo de tarjeta,
  patrimonio neto) y, si era negativo, violaba la regla de que todo `kind !== "adjustment"` tiene
  monto positivo. Era corrupción de datos, no solo una UX rara.
- "Editar" ya no se ofrece para conciliaciones. Corregir el monto de una es borrarla y volver a
  conciliar. "Dividir en categorías" también se ocultó para ajustes y transferencias, donde no
  tiene sentido (no hay con quién repartir una transferencia entre cuentas propias).

### Corregido — el modo demo dejaba ocho pantallas de escritura en blanco

- El modo demo **nunca crea sesión de Supabase** a propósito, así que `useCurrentUserId()` resuelve
  a `null` para siempre. Ocho pantallas de alta gateaban su render entero con `if (!userId) return
  null` esperando un id real que nunca iba a llegar: editar cuenta, conciliar, crear meta,
  presupuesto, deuda, regla, operación e instrumento quedaban permanentemente en blanco para
  cualquiera que entrara con "Probar con datos de ejemplo".
- Nuevo `useEffectiveUserId()`: sustituye por `DEMO_USER_ID` **solo** cuando el tri-estado ya
  confirmó que no hay sesión (`null`, no `undefined` — mientras carga sigue devolviendo `undefined`
  para no repetir el bug de escrituras con id demo que este archivo ya documentaba). Fuera del
  demo es idéntico a `useCurrentUserId()`.

### Corregido — el teclado de "editar movimiento" borraba de a cuatro toques

- `EditTransactionFlow` sembraba el buffer del teclado con `formatAmount()`, que es un formateador
  de **presentación**: separadores de miles y decimales rellenados (`"25.000,00"`). El borrado hace
  `slice(0,-1)` sobre ese string crudo, así que había que comerse cuatro toques (`,00` → `,0` →
  `,` → `.000`) antes de que desapareciera un dígito real.
- Cambiado a `amountToExpression()`, que es lo que usa el resto de la app (`PayCardSheet`,
  `recurring/[id]/edit`): sin separadores de miles, sin ceros de relleno y en el separador decimal
  del locale. Corrige de paso un bug latente: `formatAmount` sin `locale` explícito asumía `es-UY`
  sin importar el idioma de la UI, así que en `en-US` el monto se abría mal parseado.

### Agregado — desarchivar una cuenta

- El detalle de una cuenta archivada seguía ofreciendo "Archivar", sin ninguna acción inversa: una
  vez archivada no había forma de recuperarla desde la UI. Ahora la fila alterna entre "Archivar" y
  "Desarchivar" según `archivedAt`, con `accountsRepo.unarchive()`.
- Archivar o desarchivar ahora invalida **las dos** query keys —la lista y el detalle puntual— y
  espera a que terminen antes de navegar. Sin la del detalle, reabrir la misma cuenta seguía
  mostrando la acción vieja hasta recargar.

### Corregido — metas y presupuestos: monto heredado del anterior y hero sin evaluar

- Crear una segunda meta o presupuesto arrancaba con el monto (y el nombre, y la cuenta) del
  anterior. Con `cacheComponents: true`, `router.back()` no desmonta la pantalla: la deja oculta en
  `Activity` con su `useState` intacto. Se agregó el mismo efecto de limpieza que ya tenía
  `recurring/new`, que es el gancho confiable para "se abandonó este formulario".
- El monto se mostraba como la **expresión cruda tal como se tipea** (`"10000+5000"` literal, sin
  separador de miles y sin evaluar), sin ningún label que dijera qué era ese número, y sin tecla
  `=` para resolverlo — el usuario no veía el valor que iba a guardar hasta después de guardarlo.
  Ahora el hero muestra el monto ya evaluado y formateado, con su label. Corregido también un
  desajuste de separador decimal: la sugerencia de "colchón de 3 meses" usaba el del locale pero
  tipear una coma insertaba siempre `","`.

### Corregido — dos gates podían dejar la app clavada en el spinner de arranque

- **`DbOwnerSync`** resolvía la base Dexie activa en una cadena async **sin `try`/`catch`**. Si
  cualquier paso rechazaba (Dexie cerrada a mitad de operación, una query que no resuelve sin
  sesión), `setSettled(true)` nunca corría y `OnboardingGate` mostraba su spinner en toda la app
  para siempre. Ahora va en `try`/`finally`: el gate se libera pase lo que pase, y el error queda
  logueado en vez de tragarse en silencio dentro de una IIFE.
- **`OnboardingGate`** disparaba su `router.replace` de rescate **una sola vez** por transición de
  `blocked`, sin reintento. Si ese replace se perdía, el gate quedaba clavado: `blocked` no
  cambiaba, las deps del efecto tampoco, y el efecto no volvía a dispararse. Se agregó `pathname` a
  las deps para que cualquier cambio de ruta lo reintente.

### Agregado — regresión de navegación, e2e y documento de auditoría

- `src/app/__tests__/navigation-uses-replace.test.ts`: guardarraíl barato que cuenta los
  `router.back()` esperados por archivo y prohíbe que vuelva a aparecer un `router.replace(` en los
  ~16 sitios corregidos, sin levantar Playwright.
- `e2e/navigation-replace.spec.ts`: 12 casos que ejercitan cada flujo de punta a punta y confirman
  que **un solo** "volver" sale de verdad. La aserción es deliberadamente doble: que el back no
  caiga en el formulario abandonado **y** que no deje la URL igual que antes — sin la segunda, el
  bug de la entrada duplicada pasaba el test sin que la pantalla se moviera. Cuatro casos quedan en
  `skip` con el motivo documentado: deudas, inversiones y repartir un gasto leen directo de Supabase
  y no tienen historia offline/demo todavía.
- `docs/auditoria-rutas-interceptoras.md`: informe de causa raíz del bug de Next 16 más el encargo
  de auditoría para las tres rutas interceptoras que siguen vivas (`transactions/@detail/(.)[id]`,
  `@modal/(.)add`, `@modal/(.)accounts`) — 19 de aquellos 45 errores eran de `/transactions/`, así
  que ahí sigue pasando. Incluye el procedimiento de detección (el error vive en el log del dev
  server, **nunca** en la consola del navegador, que es lo que hizo que costara tres intentos
  fallidos encontrarlo) y la convención para los ~6 pares lista/detalle que todavía faltan.

### Corregido — ícono de "Categorías" en el menú "Más"

- La fila de "Categorías" de `/more` seguía usando `tag`, el mismo ícono que "Tags y comercios".
  Pasa a `square-half`, completando la unificación que 0.16.0 empezó por la sidebar de escritorio.

---

## [0.16.0] — 2026-08-05

### Agregado — gestor completo de categorías: crear, subcategorías, más íconos

- **Ajustes → Categorías deja de ser solo un selector de plantilla.** Antes ocultaba con
  `!isSystem` todas las categorías que vienen de la plantilla —o sea, todas las que el usuario
  tiene al empezar— y no ofrecía crear ninguna. Ahora muestra el árbol completo (raíces + hijas,
  siempre expandidas), permite crear una categoría nueva o una subcategoría dentro de una
  existente (`CategorySheet`, reemplaza a `EditCategorySheet`), editar nombre e ícono de
  cualquiera —incluidas las de plantilla— y archivar en cascada (`archiveWithChildren`, con un
  solo "Deshacer" que restaura todo el subárbol).
- **Picker de íconos: de 16 a ~57, agrupados por tema y con buscador.** `Icon.tsx` suma ~38
  glifos de Phosphor que el set anterior no tenía (transporte, casa y servicios, salud, ocio,
  educación, familia, compras, viajes) — antes no había gimnasio, mascotas ni educación. El
  `aria-label` de cada ícono pasa a estar traducido (antes era la clave cruda en inglés, ej.
  `"heart-pulse"`).
- **En desktop, cada categoría raíz es un bloque en un layout de masonry real** (`columns-2` +
  `break-inside-avoid`), no un grid de 2 columnas: un grid fuerza a cada fila a la altura de su
  bloque más alto, así que una categoría sin subcategorías quedaba con hueco muerto al lado de
  una con 3. Con `columns-2` cada bloque ocupa solo su propia altura y el siguiente sube a
  llenar el espacio — mismo mecanismo que un masonry de Pinterest.

### Corregido — categorías duplicadas ("Supermercado" x2, "Transporte" x2, …)

- **Causa raíz: `detachFromTemplate` anulaba `i18nKey` al editar una categoría de plantilla.**
  Renombrar "Salud" → "Médicos" la desprendía de la plantilla (`isSystem: false`) pero también
  le borraba la clave que `applyCategoryTemplate` usa para reconocerla — un cambio de plantilla
  posterior no la encontraba y creaba una "Salud" nueva. Ahora `i18nKey` queda intacto a
  propósito (es la identidad estable) y solo `isSystem` pasa a `false`; `useCategoryLabel` y
  `createOrReviveOne` se ajustaron para seguir mostrando el nombre editado y no volver a tocar
  (revivir/archivar) una fila que el usuario ya hizo propia.
- **Los duplicados que ya existían se fusionan solos.** `mergeDuplicateCategories()` corre una
  vez por entrada a la pantalla (idempotente): agrupa raíces activas por nombre+tipo, se queda
  con la que tiene más movimientos como titular, reasigna transacciones, presupuestos, reglas
  recurrentes, reglas de auto-categorización (`actions.categoryId`, anidado), el comercio por
  defecto y los splits, fusiona o reparenta las subcategorías, y archiva la duplicada — con un
  toast avisando cuántas unificó.
- **La plantilla (Básica/Completa/Empezar de cero) se aplica una sola vez.** El módulo de las 3
  opciones solo aparece mientras el household nunca la aplicó explícitamente
  (`categoryTemplateChoice` sin escribir en `settings`); al tocar "Aplicar" desaparece para
  siempre de la pantalla principal. Para cambiarla después hay una fila discreta "Cambiar
  plantilla" que la reabre en un sheet aparte — nunca como bloque permanente compitiendo con
  "Nueva categoría" por la única acción primaria de la pantalla.

### Corregido — layout de `/more/categories`

- El picker de íconos se estiraba a ~90% del ancho del overlay en desktop (mismo bug que ya se
  había resuelto en el monto de `recurring/[id]/edit`): el `Sheet` no tenía `maxWidth`, así que
  el grid de íconos quedaba en una sola fila larguísima con huecos enormes en vez de envolver en
  varias filas. Capado a `--content-max-width` (560px).
- **El botón "Nueva categoría" parecía fijo.** Vivía por fuera del contenedor con
  `overflowY: auto`, así que ni scrolleaba con la lista ni era realmente el último ítem —quedaba
  clavado abajo estuvieras donde estuvieras. Ahora es el último elemento dentro del scroller.
- En desktop, tanto ese botón como la fila "Cambiar plantilla" se estiraban por debajo de las
  dos columnas del masonry de arriba. Capados al mismo `--content-max-width` que el resto de los
  overlays de esta pantalla.
- **Faltaba el degradé de fundido del borde inferior y el corte no caía en el borde del
  viewport.** La pantalla maneja su propio scroller interno pero nunca se agregó a
  `OWN_SCROLLER_ROUTES` (`(app)/layout.tsx`) — el `<main>` compartido del shell seguía
  intentando scrollear también, dos contenedores de scroll anidados en conflicto, con el corte
  cayendo en el borde más corto del scroller interno en vez del viewport real. Registrada la
  ruta, y conectado `scroll-fade-bottom` + `useScrollOverflow` (mismo patrón que `/more`,
  `/accounts`, `/transactions` y el home).
- `padding-bottom` del scroller +50% en mobile (24px → 36px, `pb-9`) para que el botón no quede
  pegado contra la tab bar al llegar al final; en desktop vuelve a 24px (`lg:pb-6`), donde no
  hay tab bar debajo.

### Corregido — ícono de conciliación y de categorías inconsistentes

- Las filas de movimientos de conciliación (`kind === "adjustment"`) usaban `target` —el mismo
  ícono que presupuestos— en los 4 lugares donde aparecen (home, detalle de cuenta,
  `/transactions`, calendario), mientras que el botón "Conciliar" del menú de una cuenta ya
  usaba `circle-half-tilt` correctamente. Unificado a `circle-half-tilt` en los cuatro.
- La sidebar de escritorio usaba `tag` (compartido con "Tags y comercios") para "Categorías";
  la vista móvil de "Más" ya usaba `square-half`. Unificado.
- El teclado de monto de `recurring/[id]/edit` arrancaba en 0 en vez de precargar el monto
  vigente al tocar el héroe para editarlo — el comentario que lo justificaba describía un
  comportamiento contrario al del resto de la app (`PayCardSheet` sí precarga). Corregido con
  `amountToExpression()`, mismo patrón que `PayCardSheet`.

---

## [0.15.0] — 2026-08-04

### Agregado — recurrentes v3: auto-registro por regla, catch-up y multi-frecuencia

- **La idempotencia deja de ser "¿ya se cargó este período?" y pasa a ser
  `(recurring_id, fecha_de_ocurrencia)`** — de ahí caen, de un solo mecanismo, el catch-up, las
  cuatro frecuencias y la ausencia de duplicados. Antes `materialize_recurring_transactions()`
  solo corría si hoy era exactamente el día objetivo de la regla: si el `pg_cron` no corría ese
  día —y el proyecto es plan gratuito, que se pausa a la semana sin actividad— el movimiento se
  perdía para siempre. Migración `20260805000000_recurring_v3.sql`: columnas `frequency`,
  `anchor_date`, `auto_post`, `last_materialized_on`, `end_date`, `detected`; índice único
  `transactions_recurring_occurrence_uniq` sobre `(recurring_id, occurred_at::date UTC)`, sin
  filtro `deleted_at IS NULL` a propósito (una ocurrencia deshecha con "Deshacer" no se recrea);
  función SQL `recurring_occurrences_between()` espejo exacto de `src/lib/recurring/occurrences.ts`.
  De paso corrige un `WITH CHECK` tautológico en la política RLS de `UPDATE` de `recurring_rules`
  que permitía mover una regla a otro household.
- **Switch "Auto-registro" por regla, default ON.** Apagado, la regla nunca se materializa sola
  y aparece en una sección "Pendientes de cargar" con "Cargar ahora". Motor cliente
  (`src/lib/recurring/materialize.ts` + `use-recurring-materializer.ts`) corre en paralelo al
  cron server-side —necesario porque el proyecto gratuito se pausa, y porque un miembro del
  household sin ser el dueño de la regla no debería depender de que otro abra la app—, con la
  misma clave de idempotencia contra Dexie. Colisión entre los dos (`23505` sobre el índice
  único) manejada en `sync-worker.ts`: la fila local que perdió la carrera se descarta sin
  reintentar (`transactionsRepo.discardLocal`).
- **Cuatro frecuencias**: semanal · quincenal · mensual · anual, con selector de mes para la
  anual (antes solo pedía el día, y una regla anual sin mes no tiene sentido). Editar la
  frecuencia o el día reancla la regla a hoy — nunca hacia atrás, las ocurrencias ya
  materializadas no se tocan.
- **Editar el monto afecta solo el futuro.** El historial de montos se deriva de las
  transacciones ya generadas (`src/lib/analytics/recurring-history.ts`), no de una columna
  aparte — si se corrige un movimiento puntual, el gráfico lo refleja; si la regla sube de
  precio, las ocurrencias pasadas quedan intactas. Detecta aumentos ≥10% y calcula el impacto
  anual, no el delta mensual.
- **`computeMonthlyCommitted()` corregido**: sumaba `expectedAmount` de reglas en monedas
  distintas como si fueran la misma. Ahora convierte cada regla a la moneda base, normaliza por
  frecuencia y declara cuántas quedaron sin cotización (`NeedsFxBanner`, conteo nunca monto) en
  vez de mostrar un número sin significado.
- **La pantalla de lista deja de decir "Todavía no se cargó este mes"** — un texto que no existe
  en ningún documento de diseño y que además usaba mes calendario en vez del período del
  household. Ahora dice cuándo es el próximo cobro ("Próximo: Netflix mañana, US$ 3.100 de Itaú
  Crédito") y lista los próximos 30 días con fechas nombradas.
- Nuevas rutas `recurring/[id]/edit` (edición separada del detalle) y wiring de "Convertir en
  recurrente" desde el detalle de un movimiento (antes era un stub que solo mostraba un toast).

### Corregido — fechas de recurrentes mostradas un día antes en husos negativos

- Las ocurrencias se construían a medianoche UTC; en Uruguay/Argentina (UTC-3) eso se interpreta
  como las 21:00 del día anterior al formatearse en hora local, así que "1 de septiembre"
  aparecía como "31 de agosto". Corregido a mediodía UTC en todos los puntos que sintetizan una
  fecha-sin-hora, igual criterio que ya usa `occurred_at` de una transacción real.
- Dos usos de `new Date().toISOString().slice(0, 10)` (el bug ya documentado como D10 en
  `CLAUDE.md`, reintroducido acá) reemplazados por `todayIso()`.
- "Próximas ocurrencias" y la tabla de historial de montos mostraban ISO crudo (`2026-09-01`) en
  vez del formato elegido en Ajustes — ahora pasan por `formatNumericDate()` +
  `useDateFormatPreference()`. Nueva regla en `CLAUDE.md`: toda fecha/hora/decimal se muestra
  con el formato de Ajustes, nunca hardcodeado, y toda fecha-sin-hora sintética se construye a
  mediodía UTC.

### Corregido — teclado de monto y navegación en crear/editar recurrente

- El teclado del monto (dentro de un `Sheet` en la edición) se estiraba a ~90% del ancho del
  overlay en desktop. Ahora el `Sheet` entero queda capado a `--content-max-width` (560px, el
  mismo token que usa `/add`) — pasado como `style` al `Sheet`, no solo a su contenido interno.
- Tecla "=" con el mismo comportamiento que `/add`: comparte fila con "Guardar", 1:3 en reposo,
  2:2 mientras hay un operador pendiente, animado con `motion` — reproduce
  `AmountStep.tsx:322-349` en vez del prop `equals` de `Keypad` (estático, sin usar en el resto
  de la app).
- **Estado de borrador que sobrevivía a "volver atrás".** Con `cacheComponents: true` (Next
  16.2.6), `router.back()` no desmonta la pantalla — la deja oculta (`Activity`, modo hidden) con
  su `useState` intacto, así que un monto editado sin guardar reaparecía intacto al volver a
  entrar a la misma ruta. Fix: la *cleanup* de un `useEffect` de dependencias vacías, que corre
  exactamente cuando `Activity` oculta el árbol, resetea el borrador. Aplicado en
  `recurring/new` y `recurring/[id]/edit`.
- **Guardar dejaba "Editar" atrapado en el historial.** Al confirmar, ambas pantallas hacían
  `router.push()` hacia el detalle/lista en vez de `router.replace()` — el historial quedaba
  `[lista, detalle, editar, detalle]`, así que "volver" desde el detalle post-guardado caía en
  el formulario de edición abandonado en vez de saltar a la lista. Mismo patrón encontrado en
  otras ~14 pantallas de la app (`accounts`, `goals`, `budgets`, `debts`, `transactions`,
  `investments`, `more/rules`) — pendiente de una pasada aparte.

### Cambiado — Tailwind por defecto en las pantallas de recurrentes

- `RecurringPageContent.tsx`, `RecurringMonthCalendar.tsx`, `recurring/new` y
  `recurring/[id]/edit` convertidos de `style={{}}` a clases de Tailwind para layout estructural
  y tokens ya mapeados en `@theme inline` (`bg-surface-2`, `text-text-muted`, `rounded-card`,
  etc.). Nueva regla en `CLAUDE.md`: Tailwind por defecto hacia adelante, `style={{}}` reservado
  para props de componentes del design system (no aceptan `className`), valores dinámicos y
  custom properties — no dispara una migración retroactiva del resto de la app.

---

## [0.14.0] — 2026-08-04

### Corregido — el swipe izquierda ya no borra en el acto

- `SwipeableRow` (`/transactions` y ahora también el home) pasaba directo de "soltar el
  swipe" a `softDelete`, sin paso intermedio — un gesto de una mano bastaba para borrar un
  movimiento. Ahora el swipe izquierda pasado el umbral convierte la fila en una
  confirmación destructiva (tacho + "¿Borrar movimiento?" + botón "Borrar"), del mismo alto
  que la fila normal para no desincronizar el virtualizador de `/transactions`. Recién al
  tocar "Borrar" corre el `softDelete` de siempre, con el mismo toast de "Deshacer".
- La confirmación se cancela con swipe inverso hacia la derecha, tap fuera de la fila,
  scroll, o sola a los 4 segundos — nunca queda pegada esperando un tap explícito de "no".

### Agregado — swipe para editar/borrar en "Últimos movimientos" del home

- Los mismos gestos de `/transactions` (swipe derecha edita, swipe izquierda confirma y
  borra) ahora también están disponibles en la lista de últimos movimientos del dashboard,
  que es donde más se busca corregir o borrar algo recién cargado. Sin long-press ni
  multi-selección — eso sigue siendo exclusivo de `/transactions`.
- Se extrajo `useDeleteTransactionWithUndo()` (`src/features/movements/use-delete-transaction.ts`)
  del `softDelete` + toast "Deshacer" que estaba copiado en la lista y el detalle, para que
  el home lo reuse sin triplicarlo de nuevo.

---

## [0.13.0] — 2026-08-04

### Agregado — "Pago de tarjeta" trazable, vinculado al resumen del ciclo

- **Unifica los dos caminos que existían para pagar una tarjeta** en un solo módulo,
  `src/features/cards/pay-card.ts`, montado desde un único componente (`PayCardSheet`) en los
  dos puntos de entrada (`/accounts/[id]` y `/accounts/[id]/card`). Antes uno de los dos
  caminos guardaba una transferencia genérica sin ningún vínculo a `card_statements`, así que
  un pago de tarjeta era indistinguible de cualquier otra transferencia en el historial.
- **Los resúmenes de ciclo (`card_statements`) ahora se abren solos.** Nueva migración con
  `open_card_statements()` (cron diario a las 02:00, antes del despacho de notificaciones):
  abre el resumen del ciclo en curso, recalcula su saldo sumando las transacciones del
  período y cierra los que ya vencieron (`paid`/`closed`/`overdue`) — sin FX, porque
  `amount`/`currency_code` de una cuenta ya están en su propia moneda. Esto también
  desbloqueó el recordatorio de vencimiento por push que ya existía en el código pero nunca
  se disparaba por falta de una fila de resumen contra la cual evaluar `due_date`.
  `dispatch_due_notifications()` suma un aviso a vencidos, con clave de dedup semanal para no
  avisar una sola vez y nunca más.
- **Editor de monto cruzado en `PayCardSheet`**: dos campos (origen ↔ tarjeta) con tasa
  siempre mostrada anclada a USD, editable con teclado propio, congelando el rate implícito
  al salir del campo de origen — antes la tasa quedaba pegada a un valor viejo en memoria en
  vez de volver a tomar la de `/currencies` en cada pago nuevo.
  `src/lib/fx/rate.ts` suma `rateFromAmounts()` para derivar esa tasa implícita.
- **Saldo insuficiente bloquea antes, no después.** El selector de cuenta de origen muestra
  "saldo insuficiente en X" en rojo por cada cuenta que no alcanza (incluida la resolución
  cruzada de moneda) y el botón de confirmar queda deshabilitado — antes solo se descubría
  después de abrir la calculadora completa.
- **Reconciliación al pagar**: si lo pagado no coincide con lo esperado, un paso adicional
  ofrece "fue un pago parcial" o "con esto queda saldada" (esta última genera el ajuste sobre
  la cuenta de la tarjeta), nunca un diálogo de confirmación bloqueante.
- Nuevo `src/lib/analytics/card-cycle.ts` (con test): `isCreditCardAccount`,
  `cardPaymentSources` (excluye la tarjeta misma, archivadas y cualquier otra tarjeta de
  crédito como origen), `cardCycle`, `cycleExpenseTotal`, `expectedDueAmount` — antes vivían
  duplicados o inline solo en `card/page.tsx`.

### Agregado — saldo insuficiente bloquea un gasto en cuentas de liquidez real

- Al cargar un `expense`, si el monto ingresado supera el saldo de la cuenta seleccionada, el
  monto se marca en rojo ("saldo insuficiente") y el guardado queda bloqueado — incluido el
  atajo de categoría rápida de un toque, no solo el botón "Guardar" principal.
- **Nunca bloquea en tarjetas de crédito ni préstamos** (`LIABILITY_ACCOUNT_KINDS`): esas
  cuentas pueden ir en negativo por diseño, a diferencia de una caja de ahorro, billetera
  virtual o cuenta de crypto, que representan liquidez real.
- Nuevo `computeExpenseDebitAmount()` en `save-transaction.ts`, mismo criterio que ya usaba
  el gate de saldo insuficiente de las transferencias.

### Agregado — `ChartCard` + `DataList`: todo gráfico con su alternativa en tabla

- `docs/contrato-componentes.md` documentaba `ChartCard` (el wrapper obligatorio de todo
  gráfico, con el toggle "ver como tabla") como `[spec]`, sin código en ningún lado. Se
  implementa junto con `DataList` (la tabla sin bordes que sirve de alternativa accesible) y
  se cablea en el gráfico de evolución de `/accounts/[id]`, el primer caso real. Selección por
  superficie, nunca violeta — ese color queda reservado para la acción primaria de la
  pantalla.

### Agregado — radar de gastos por categoría en el panel de detalle de `/transactions`

- En desktop, el panel derecho (antes solo "Elegí un movimiento de la lista...") suma, debajo
  de un separador, un radar de las 5 categorías con más gasto + "Otros" del último período
  cerrado — mismo cálculo que `/analytics/categories`, excluyendo `needs_fx` en vez de
  sumarlo como si valiera 0. Si el período cerrado no tiene datos todavía (cuenta nueva),
  cae al período en curso en vez de dejar el panel vacío, mismo criterio que ya usan los
  presupuestos para leer mientras el mes corre.
- Único componente del sistema de gráficos construido sobre una librería (`recharts`) en vez
  de SVG a mano — evaluado a propósito: los otros 12 primitivos de `charts/` (Sankey, mapa de
  calor de calendario, waterfall, etc.) no tienen equivalente en `recharts`, así que migrar el
  resto habría significado mantener dos sistemas en paralelo. El radar es la excepción porque
  un polígono de N ejes variable no valía la pena reimplementar, y queda completamente
  repintado con los tokens del sistema (grilla hairline, `--data-1`, tooltip idéntico al de
  `LineChart`) — nada del look por defecto de `recharts` queda visible. Carga solo en esta
  pantalla vía import dinámico, no entra al bundle del resto de la app.

### Corregido — `<Amount showSign={false}>` ocultaba el signo negativo, no solo el "+"

- El saldo de una cuenta en descubierto (o una tarjeta con deuda) se mostraba como si fuera
  positivo en cualquier lugar que pasara `showSign={false}` — que es la mayoría de los saldos
  de cuenta de la app. `showSign` ahora solo controla si el "+" de un monto positivo se
  dibuja; el "−" de un monto negativo se muestra siempre. La UI debe mostrar la realidad.

### Corregido — "Pasivos" del home sumaba tarjetas en otra moneda 1:1, sin convertir

- El subtotal de pasivos de `/accounts` sumaba `currentBalance` de cuentas de distinta moneda
  sin conversión — una tarjeta en ARS con saldo −15.700 se sumaba como si fueran −15.700 USD.
  `computeNetWorth()` ahora devuelve `assets`/`liabilities` ya convertidos a la moneda base
  con la misma tasa por cuenta que arma el patrimonio neto, y `/accounts` los consume
  directo en vez de recalcularlos a mano con un `reduce` propio.

### Corregido — conciliaciones nunca resolvían tipo de cambio de verdad

- `/accounts/[id]/reconcile` y el ajuste de reconciliación al pagar una tarjeta tenían el
  mismo bug de copiar-pegar: las dos ramas de un ternario fijaban `fxRate: null`, así que una
  conciliación quedaba `pending` incluso con una cotización perfectamente disponible. Se
  extrae `resolveFxForAccountCurrency()` en `save-transaction.ts` — la misma resolución real
  que ya usa cualquier captura normal — y las dos pantallas pasan a usarla.
- El cartel "no suma al total" de un movimiento sin cotizar era engañoso para una
  conciliación (si el ajuste es en la moneda de la cuenta, sí suma al patrimonio neto) — se
  reescribe a "no es gasto ni ingreso del período", y las conciliaciones dejan de contarse en
  el aviso de "sin resolver" del home: el patrimonio neto y el resto de los agregados nunca
  leen el `amount_base` propio de una transacción, así que pedirle un tipo de cambio a una
  conciliación no tenía ningún efecto real.

### Corregido — `fxRepo` no encontraba overrides guardados en el par de moneda inverso

- Un override cargado en `/currencies` como `nonBaseCurrency → baseCurrency` no aparecía al
  consultarlo en la dirección opuesta (p. ej. desde `PayCardSheet`), y el pago de tarjeta caía
  a una tasa vieja en memoria en vez de la cargada en ajustes. `getManualOverride()` ahora
  intenta el par exacto y, si no hay nada, el inverso, invirtiendo la tasa encontrada.
- `/currencies` invalida también la cache de `fx-suggested-rate` al guardar un override o
  refrescar — antes quedaba una tasa sugerida vieja cacheada en cualquier otra pantalla que
  la usara.

### Corregido — gráfico de evolución de tarjeta al revés, pagos de tarjeta ausentes de su propia lista de movimientos, formato de fecha ignorado

- El gráfico de evolución de una cuenta de tarjeta de crédito graficaba el saldo (negativo,
  bajando al gastar) en vez del consumo acumulado — ahora se invierte el signo solo para
  tarjetas: sube al gastar, baja al pagar, se va a cero al saldar. Las cuentas de liquidez
  siguen graficando el saldo tal cual.
- Un pago de tarjeta solo aparecía en los movimientos de la cuenta de ORIGEN, nunca en los de
  la tarjeta misma — `useTransactions` se amplía para traer movimientos donde la cuenta es
  origen o contraparte, y la fila muestra el monto/moneda del lado que corresponde según
  desde qué cuenta se está mirando.
- La preferencia "Formato de fecha" de los ajustes no se respetaba en "Movimientos de esta
  cuenta": se mostraba el string ISO crudo en vez de la fecha formateada.

### Corregido — `mirror_transactions` sin `counter_account_id`

- Una migración posterior había redefinido la función sin devolver esta columna, así que el
  modo espejo (`/family/mirror/[memberId]`) no podía distinguir un pago de tarjeta de una
  transferencia común del lado del miembro mirado. Nueva migración que la repone; se retira
  el cast provisorio del lado de TypeScript en `mirror-repo.ts`.

### Agregado — filtro y renderizado de "Conciliación" en toda la app

- `/transactions` suma "Conciliación" como tipo de filtro. Ícono, texto y color distintos
  (nunca "Transferencia" genérico) en el home, la lista, el calendario y el detalle de
  movimiento — más un `Sheet` de resolución de tipo de cambio por movimiento (`FxEditor` +
  `Keypad`) accesible desde el propio detalle cuando queda sin resolver.

---

## [0.12.1] — 2026-08-04

### Corregido — bento del dashboard: sin card redundante, sin columnas alineadas

- **Se elimina la card "Total convertido"** del bento de cuentas del home. Su saldo era
  literalmente el mismo número que ya se muestra como patrimonio neto en el héroe de la
  pantalla — repetir la misma cifra dos veces violaba el presupuesto de ruido (una sola cifra
  héroe por pantalla) sin aportar nada. El bento pasa a mostrar solo cuentas reales; la card
  destacada la decide el layout, no una card sintética con un id `"__total"`.
- **El ancho de cada card ya no sale de cuánto mide el saldo formateado.** El algoritmo
  anterior (`computeBaseSpans` + `packBentoRows`) normalizaba el largo del monto contra el
  rango de la pantalla y repartía el sobrante en la card de mayor peso — con 6 cuentas eso
  daba filas de `[7,5] / [8,4] / [8,4]`: dos columnas con anchos que saltaban de 4 a 8
  columnas sin significado, y agregar una cuenta con un saldo distinto reacomodaba toda la
  grilla. Se reemplaza por `bentoLayout(n)`: una forma ELEGIDA por cantidad de cuentas (fila 1
  ancla con `[7,5]` o `[6,3,3]`, el resto en filas de 3 y de 2 asimétricas, nunca `[4,4,4]`
  parejo). El contenido pasa a solo ORDENAR las cuentas dentro de esa forma —el saldo más
  largo va al slot más ancho de su fila—, nunca a decidir el ancho del slot.
- **Ninguna fila del bento comparte un límite de columna con la fila de arriba.** Dos cards
  apiladas del mismo ancho en la misma posición se leen como columnas de una tabla, no como
  bento. `pickRow()` elige, entre las variantes de cada forma de fila, la que no repite
  ningún límite de columna con la fila inmediata anterior — verificado con un test que corre
  las 24 primeras cantidades de cuentas.
- Nuevo test unitario `AccountCarousel.test.ts` sobre `bentoLayout` (145 aserciones): suma
  exacta de 12 columnas por fila, ninguna cuenta perdida ni duplicada, ninguna fila de una
  sola card salvo con una cuenta, ningún span menor a 3, y sin límites de columna compartidos
  entre filas vecinas.

---

## [0.12.0] — 2026-08-04

### Agregado — borrar todos los datos del household

- **`/more/data` suma una zona de riesgo: "Borrar todos mis datos".** Solo visible para el
  `owner` del household (chequeo contra Supabase, no contra el caché local — un miembro
  agregado desde otro dispositivo puede no estar todavía en Dexie). Un sheet de confirmación
  enumera lo que se va a perder con conteos reales (cuentas, movimientos, categorías, tags,
  presupuestos/metas, recurrentes/deudas, inversiones) y, si el household es compartido,
  agrega cuántos miembros más pierden sus datos también. Al confirmar, una barra de progreso
  real avanza en 7 pasos — cada uno un round-trip genuino al servidor, no un timer simulado —
  y termina en un mensaje de éxito o, si algún paso falla, un error que nombra qué paso fue y
  permite reintentar desde ahí (los pasos son idempotentes, nunca hace falta reiniciar).
- **Hallazgo que cambió el diseño**: en las 44 tablas del esquema no existe ni una sola
  política RLS de `DELETE` — el proyecto es soft-delete en todas partes por diseño (`UPDATE
  ... SET deleted_at`, nunca un borrado real desde el cliente). Un borrado "para siempre" de
  verdad necesitó una excepción consciente: una función Postgres nueva `SECURITY DEFINER`
  (`is_household_owner`, `purge_household_step`) que valida el permiso ella misma y ejecuta
  el `DELETE` real, en el orden correcto de FKs (ninguna tabla de household tiene `ON DELETE
  CASCADE`, así que el orden entre los 7 pasos se resolvió a mano contra el esquema real).
  Con su test de RLS correspondiente: un member no puede ejecutarla, un owner ajeno tampoco,
  y solo se borran filas del household indicado — verificado con un household de control que
  sobrevive intacto.
- **Qué NO se borra**: `households`/`household_members`/`household_invites`/`profiles`
  (estructura y datos de registro — el household queda vacío, no se borra, para no forzar un
  re-onboarding) y `audit_log` (append-only, nunca se purga).

---

## [0.11.3] — 2026-08-04

### Agregado — ancho consistente en desktop, rediseño de listas/formularios y `ZMark` animado

- **El header ya no cambia de ancho según la ruta.** Antes solo `/`, `/transactions` y
  `/accounts` usaban el ancho ancho (1200px) del layout; el resto de la app (`/analytics`,
  `/more` y casi todas las subpáginas) caía a un ancho angosto (560px) por una lista corta de
  rutas "wide" en `contentWidthFor()` — el header, que comparte el mismo `maxWidth` que el
  contenido, quedaba visiblemente más chico ahí. Se retira esa lista: el layout usa siempre
  el ancho ancho, y cada página decide su propio ancho de lectura por dentro cuando le hace
  falta uno más angosto (formularios cortos), en vez de heredarlo del layout. Se borra
  `src/lib/nav/content-width.ts` y su test, que quedaron sin uso.
- **`/analytics`**: las dos secciones ("Ya se puede ver" / "Todavía no") pasan de una columna
  de cards de ancho completo a un grid de 2 columnas en desktop, cada card completamente
  clickeable (antes solo el ancho del texto respondía al toque).
- **`/recurring`**: el calendario de vencimientos (antes solo accesible navegando a
  `/recurring/calendar`) se extrajo a un componente compartido y ahora vive al lado de la
  lista en desktop — el botón "Ver el mes en calendario" desaparece ahí (sigue en mobile) y
  se puede navegar el mes sin perder la lista de la izquierda.
- **`/more/categories`** y **`/more/tags`**: pasan a 2 columnas reales en desktop (categorías
  propias / plantilla; tags / comercios) en vez de una sola lista larga.
- **`/more/settings`** y **`/more`**: se agrupan en 2 columnas por afinidad (regional/moneda
  vs. app/apariencia en Ajustes; Dinero+Personas vs. Sistema en Más) para que entren sin
  scroll de sobra en desktop.
- **`ZMark`, nuevo `variant="flip"`.** Mismo componente y recorrido de siempre (la Z de 3×3
  bloques), pero cada celda "voltea" sobre su eje vertical (`scaleX` a cero y de vuelta,
  cambiando de color en el medio) en vez de solo cambiar de color — un giro lateral tipo
  tablero de aeropuerto, no un parpadeo. Respeta el ajuste de intensidad de movimiento
  (completa/reducida/mínima) igual que el resto del componente. Rellena la columna vacía de
  `/more/profile` y de siete formularios cortos (deudas, metas, recurrente, invitar
  familiar, regla nueva, trade e instrumento nuevos) que antes quedaban centrados con aire
  libre a los dos lados o con una columna sin nada del lado derecho.
- **`/more/profile`**: los campos (nombre, email, fecha de nacimiento, país) vuelven a una
  sola columna a la izquierda — son pocos y entran sin scroll — con el `ZMark` a la derecha.

### Corregido — `/more/about`

- **Se quitaron las filas "Código fuente" y "Licencia"** (y la mención de licencia MIT en el
  texto de créditos) de la pantalla "Acerca de".
- **Cita nueva al pie**, anclada al fondo del área de contenido de la pantalla (no del
  viewport — sigue el flujo normal, nunca se superpone ni queda fija), traducida a los tres
  idiomas.

---

## [0.11.2] — 2026-08-03

### Corregido — navegación de detalle en mobile (PWA), tarjetas desde el home y modo privacidad

- **Tocar un movimiento o una cuenta en mobile no abría el detalle.** `transactions/layout.tsx`
  y `accounts/layout.tsx` distinguían un hard-reload de una navegación interceptada mirando
  solo el `pathname` actual, pero ambos casos cambian la URL de la misma forma — una
  navegación blanda (tocar un ítem con la lista ya montada) tomaba la misma rama que un
  hard-reload y descartaba el slot `detail` (el `Modal` con el detalle real). Ahora se compara
  contra el `pathname` del primer render del layout, que solo coincide en el hard-reload real.
- **El detalle interceptado, cuando sí abría, quedaba sin header ni forma de volver** salvo el
  gesto de swipe — el `AppHeader` único del shell queda tapado debajo del overlay del `Modal`.
  `Modal` ahora se monta con `createPortal` (inmune a cualquier ancestro con `transform`/
  `filter`/`contain` que lo recortara) y trae su propio botón de volver en modo `contained`.
- **Al scrollear en la PWA instalada, se movía toda la pantalla, incluido el tab bar** —
  rebote de documento propio de iOS standalone. Se corta con `overscroll-behavior: none` y
  bloqueando el scroll del documento en las rutas con el shell de `(app)/`.
- **Tocar una tarjeta de crédito desde el home** ya no manda a `/accounts/[id]/card` (una
  pantalla sin las acciones del resto de las cuentas) sino a `/accounts/[id]`, igual que
  `/accounts` y `/debts` — "Pagar tarjeta" y "Resumen del ciclo" siguen accesibles desde ahí.
- **Modo privacidad, rediseñado:** ya no blureaba los glifos reales (`filter: blur(8px)` sobre
  texto se recorta contra cualquier ancestro con `overflow: hidden`, dejando manchones
  cortados) — ahora el monto real sigue en el DOM con `visibility: hidden` (define la caja,
  cero salto de layout al prender/apagar) cubierto por una píldora con blur + degradé del
  mismo ancho/alto exacto. La primera versión de este cambio todavía se veía prolija en
  cifras chicas pero con bordes cortados en la hero de patrimonio neto y el bento de cuentas:
  ahí la píldora vivía adentro de la misma caja con `overflow: hidden` que usa `fit` para
  medirse, así que su propio blur no tenía sangría. Se resuelve envolviendo esa caja en otra
  sin recorte, del mismo tamaño. De paso quedan cubiertos dos montos que el modo privacidad
  no alcanzaba: el delta "vs. semana pasada" del home, "gastado"/"ingresado este período", y
  el monto convertido a la moneda base que se muestra bajo el monto original en cada
  movimiento de la lista.

---

## [0.11.1] — 2026-08-03

### Agregado — header único por página y "Nueva cuenta" como card discontinua

- **Un solo header por pantalla, siempre.** Antes el shell dibujaba su propio `AppHeader`
  únicamente en la raíz de cada tab y cada subpágina traía el suyo por separado; ahora hay
  un único `AppHeader` que vive en `(app)/layout.tsx` y cada página le pasa su título/volver/
  slot extra a través de un contexto nuevo (`usePageHeader`, `page-header-context.tsx`) en vez
  de instanciar el componente ella misma. Elimina la duplicación de punto de sync y hace que
  el ancho del header nunca se desalinee del contenido de la ruta activa.
- **Ícono del tab "Home" pasa de casa a grilla** (`squares-four`) en tab bar, sidebar y menú
  desktop — refleja mejor el resumen tipo dashboard que muestra esa pantalla.
- **"Nueva cuenta" en `/accounts` es ahora una card con trazo discontinuo violeta**, mismo
  ancho que las cards de cuenta vecinas, al final del listado (mobile y desktop) en vez de al
  principio — el trazo se dibuja a mano con SVG porque `border-style: dashed` no permite
  elegir el largo del guion.
- **El panel de detalle de `/accounts` en desktop es un 20% más ancho** (420px → 504px de
  tope), y recargar directo una URL de detalle (`/accounts/<id>`, `/transactions/<id>`) ya no
  rompe el split view: antes el detalle aparecía en la columna equivocada en desktop y
  duplicado (detalle + placeholder) en mobile, porque las rutas interceptoras de Next.js solo
  activan en navegación blanda, nunca en un hard reload — ambos layouts ahora detectan ese
  caso por la URL y arman el split a mano.

### Corregido — precisión del tipo de cambio, saldo insuficiente y detalle de cuenta

- **El tipo de cambio ya no muestra ruido de 12 decimales** ("0,00065563", "1.507,42499...")
  en `/add` ni en `/currencies`: se redondea a 2 decimales cuando el valor es ≥ 1 y a 6 cuando
  es menor, en cada punto donde se muestra o se guarda un valor editado a mano — incluye el
  slider y el texto de `FxEditor`, la lista de `/currencies` y su toggle de inversión.
- **El override manual de `/currencies` ahora guarda exactamente el valor tipeado** ("1525,25"
  quedaba guardado como "1525,249998960923" por la falta del mismo redondeo).
- **El ícono de lápiz del tipo de cambio en `/add` ahora abre el teclado numérico** para
  editarlo a mano — antes no hacía nada porque `FxEditor` se llamaba sin `onOpenKeypad`.
- **Transferencias: no se puede elegir la misma cuenta como origen y destino**, ni al revés.
- **"Saldo insuficiente" en una transferencia bloquea "Guardar"** y muestra el aviso, en vez
  de permitir que una cuenta quede en negativo.
- **Overflow del bloque "Resumen del ciclo"** en el detalle de una tarjeta de crédito: `all:
  "unset"` resetea `box-sizing` a `content-box`, así que `width: 100%` + `padding` lo dejaba
  32 px más ancho que su contenedor — se repone `box-sizing: border-box` en el mismo `style`.

---

## [0.11.0] — 2026-08-03

### Agregado — bento grid de cuentas, fondo de puntos y "pagar tarjeta" ancla al destino

- **Resumen de cuentas del home, en desktop: bento grid de 12 columnas en vez de un carrusel
  de una fila.** El ancho de cada card se deriva del largo real del monto que muestra
  (dataset-relativo: se recalcula contra el mínimo/máximo presentes en pantalla, no un corte
  fijo de caracteres) — la cuenta con el saldo más largo se ve más grande, la más corta más
  chica, sin huecos vacíos y sin que ninguna fila deje de sumar sus 12 columnas exactas.
  "Total convertido" queda fija como ancla visual (2 columnas más ancha que el resto).
  Verificado con un conjunto de escenarios sintéticos (1, 2, 3, 10, 12 y 20 cuentas, montos
  parecidos y muy distintos) para confirmar que el reparto se sostiene ante cualquier cantidad
  de cuentas. En mobile sigue siendo el carrusel horizontal de siempre, ahora con drag real de
  mouse en desktop (antes solo funcionaba con mayús + rueda).
- **En desktop, el home pasa a 2 columnas** (patrimonio/cuentas/tarjetas a la izquierda,
  gastado-ingresado/insight/movimientos a la derecha) a partir de 1280px — no 1024px, para no
  apretar el bento grid contra la sidebar en anchos intermedios.
- **Fondo de puntos enmascarado, opt-in y apagado por defecto** (`Ajustes → Apariencia`):
  retícula sutil que se desvanece hacia los bordes del viewport, con densidad e intensidad
  ajustables en 3 niveles cada una (incluida una intensidad "vívida" adicional). Nunca se ve en
  header, tab bar, sidebar, modales ni sheets — solo en el área de contenido.
- **Degradado de scroll inferior generalizado.** El mismo fade suave que ya tenía `/accounts`
  se aplica ahora también al Sidebar de escritorio (antes cortaba el contenido de forma recta y
  abrupta) y a `/transactions`, con aire real después del último ítem en los tres casos.
- **"Pagar tarjeta" ancla el monto al destino, no al origen.** El monto tipeado en el flujo de
  pago de tarjeta ahora se interpreta siempre en la moneda de la tarjeta (el dato fijo es
  "cuánto hay que cubrir"), incluso mientras la cuenta de origen todavía no está elegida; una
  vista previa de solo lectura muestra cuánto sale realmente de esa cuenta una vez elegida.

### Corregido — scroll horizontal del home, cumpleaños, calendario y headers de subpáginas

- **Scroll horizontal indebido en el home en mobile.** El scroller propio de la página definía
  `overflow-y: auto` sin `overflow-x` explícito — por la coacción de CSS que ya rompió el mismo
  patrón antes en este proyecto, el navegador terminaba habilitando `overflow-x: auto` también,
  dejando toda la pantalla arrastrable de costado en vez de solo el carrusel de cuentas. Se
  corrigió en el home y, preventivamente, en `/accounts`, `/transactions` y `/more`.
  - **Sidebar recortado de forma abrupta al final** (en vez de un fade suave): el
    `padding-bottom` de aire vivía en el contenedor no-scrolleable en lugar de dentro del
    `<nav>` que scrollea — el degradado gastaba la mayor parte de su alto sobre superficie
    sólida y le quedaba muy poco margen sobre contenido real.
- **El banner de cumpleaños nunca coincidía con "hoy" para usuarios en husos horarios
  negativos** (Uruguay, Argentina): `new Date("YYYY-MM-DD")` parsea como medianoche UTC, y en
  UTC-3 eso cae en el día anterior en horario local. Se parsean los componentes de fecha a
  mano, como fecha local.
- **Formato de fecha del calendario de movimientos** mostraba "Septiembre De 2026" (con el
  conector capitalizado por error) — ahora "Septiembre 2026", sin conector.
- **Falta el `AppHeader` propio en los estados de carga y vacío** de las subpáginas de `/more`
  (deudas, grupo familiar, metas, recurrentes): antes solo aparecía con datos cargados, dejando
  esos estados sin forma de volver atrás.
- **AccountCarousel no permitía click-and-drag con mouse en desktop** (solo mayús + rueda) y,
  en una iteración intermedia del bento grid, dejó de navegar al hacer click — ambos corregidos
  vía Pointer Events con umbral de 8px para distinguir click de arrastre.

## [0.10.0] — 2026-08-03

### Agregado — tarjetas de crédito, pago por transferencia y cumpleaños

- **Liquidación real de resumen de tarjeta.** "Pagar tarjeta" ya no enruta genérico a
  `/add`: precarga el módulo de transferencia con la tarjeta como destino y el monto a pagar,
  deja la cuenta de origen sin elegir a propósito, y si el origen termina en otra moneda
  muestra la tasa de cambio ajustable (`FxEditor`, mismo componente y misma dirección de
  lectura que Ajustes/Monedas: "1 USD = X", nunca "1 ARS = 0,00066 USD"). Al confirmar,
  `cardStatementsRepo.markPaid` acumula el pago (soporta parcial) y cascadea a
  `debtsRepo.markInstallmentPaid` sobre las cuotas del período liquidado — antes esas dos
  funciones existían pero nadie las llamaba.
- **Reconciliación del "dólar tarjeta".** Si la tarjeta se paga desde una cuenta de otra
  moneda, la transferencia convierte con la cotización normal (no la marcada del resumen
  bancario) — la diferencia entre el nominal y lo efectivamente aplicado se muestra sola, sin
  que la app calcule ningún impuesto. La pantalla de ciclo de la tarjeta suma un desglose de
  consumos por moneda.
- **Recordatorio de vencimiento.** Nuevo tipo de notificación `card_statement_due` (aviso 3
  días antes de vencer, con el mismo mecanismo de opt-in/de-dup que `budget_alerts` y
  `recurring_reminders`), y `creditLimit` ahora editable al crear/editar una tarjeta.
- **Sección propia para tarjetas en el home**, separada del carrusel de cuentas de liquidez —
  una tarjeta no es plata disponible, es gasto acumulado pendiente de pagar.
- **Cumpleaños.** La fecha de nacimiento (opcional, solo estadística) ahora muestra la edad
  calculada en el perfil, alimenta un desglose por rango etario en el panel de operador, y
  dispara un banner no bloqueante y descartable en el home el día del cumpleaños.

### Corregido — carrusel de cuentas, transferencias, recurrentes, símbolos de moneda

- **El carrusel de cuentas del home quedaba recortado e inutilizable en mobile** — `<main>`
  activaba `overflow-x: auto` implícito (regla de CSS: `overflow-y` sin `overflow-x`
  explícito) que le ganaba el gesto táctil al scroll propio del carrusel. En desktop, sin
  touch ni scrollbar visible, tampoco había forma de moverlo con mouse — ahora la rueda
  vertical hace scroll horizontal cuando el contenido desborda.
- **Transferencias entre monedas distintas no mostraban ni dejaban ajustar el tipo de
  cambio** — se resolvía en silencio contra `fxRepo`. Ahora `AmountStep` muestra `FxEditor`
  siempre que las dos cuentas de una transferencia tengan monedas distintas, con override
  manual persistido en el movimiento.
- **Un origen de transferencia podía quedar elegido sin que el usuario lo tocara** —
  `CaptureFlow` caía a `accounts[0]` por default; ahora ese fallback no aplica a
  transferencias, así que "Guardar" queda deshabilitado hasta elegir las dos cuentas.
- **Recurrentes: la moneda del monto ignoraba la cuenta elegida** y usaba siempre la moneda
  base del household — el propio `currency_code` guardado en la regla también estaba mal, no
  solo la vista. El detalle ahora muestra cuenta + moneda (antes solo el nombre). `/recurring`
  suma filtros por cuenta y moneda, y el detalle de cualquier cuenta (o la pantalla dedicada
  de tarjeta) enlaza a sus recurrentes asociadas.
- **`/recurring` esperaba el historial completo de movimientos** para renderizar incluso las
  reglas ya resueltas — se acotó al mes en curso, más rápido y sin motivo para pedir más.
- **Símbolos de moneda: el peso uruguayo no tenía uno propio**, usaba el "$" genérico
  indistinguible de cualquier otro peso en la misma lista — ahora es "$U". Se sumaron más
  símbolos reales y los siete decimales de 3 cifras de ISO 4217 (BHD, IQD, JOD, KWD, LYD, OMR,
  TND) que faltaban en la tabla. Nueva nota en Acerca de explicando que ISO 4217 define
  códigos, no símbolos.
- **Scroll horizontal no pedido en el panel de detalle de escritorio** (`/accounts` y
  `/transactions`, columna derecha) — mismo origen que el bug del carrusel: `overflow-y: auto`
  sin `overflow-x` explícito. Ahora esa columna tiene `min-width`/`max-width` fijos y
  `overflow-x: hidden`.
- Franja blanca en el borde inferior del sidebar y de `/accounts` en desktop, reemplazada por
  un degradé de desvanecido. Ícono de comercio para payees (antes billetera). "Cerrar sesión"
  al final del sidebar de escritorio.

## [0.9.31] — 2026-08-03

### Corregido — categoría seleccionada visible, etiquetas en home, patrimonio neto y cuentas del home

- **La categoría elegida en `/add` no se distinguía de las demás** — a diferencia de las
  etiquetas (violeta cuando están activas), los chips de categoría nunca marcaban cuál
  estaba seleccionada. Ahora sí.
- **Los últimos movimientos del home tenían el mismo problema que ya se había arreglado en
  `/transactions`**: la segunda línea repetía la categoría en vez de mostrar la etiqueta
  cuando el movimiento tenía una. De paso, tocar un movimiento del home llevaba al listado
  general en vez de al detalle de ESE movimiento — mismo bug, mismo lugar, se corrigió junto.
- **"Patrimonio neto" se desbordaba a dos líneas en Análisis.** El bloque pasa de 50/50 a
  60/40 con "tasa de ahorro" (la cifra de patrimonio es la que más se estira: moneda + miles;
  la otra es casi siempre corta, "12,3%"), y `StatTile` suma una prop `fit` — mismo mecanismo
  que `Amount` (encoge el `font-size` en vez de pasar a una segunda línea), para cuando ni el
  60% alcanza.
- **Las cards de cuenta del home llevaban al listado general de Cuentas**, no al detalle de
  la cuenta tocada — `AccountCarousel.onSelect` recibe el id pero no se estaba usando.

## [0.9.30] — 2026-08-03

### Agregado/Corregido — etiquetas visibles en movimientos, ancho de filtros, scroll en desktop, sync y monto en cero

- **Etiquetas visibles donde faltaban.** En la lista de movimientos, la segunda línea ("Cuenta
  · Categoría") repetía la categoría que el ícono y el título ya muestran — ahora, si el
  movimiento tiene etiquetas, se ven ELLAS ahí en vez de la categoría de nuevo. El detalle de
  un movimiento suma una fila de Etiquetas (antes no aparecían en ningún lado). Y los Filtros
  suman una sección de Etiquetas debajo de Categorías, con el mismo filtrado real.
- **El sheet de "Filtros" ocupaba el 100% del ancho en desktop** — a partir de `lg` pasa a
  90% con un techo de 1500px, como cualquier sheet ancho debería comportarse en un monitor.
- **Las barras de scroll quedaban pegadas al texto en desktop** — en la lista de movimientos,
  la de cuentas, y sobre todo en la tercera columna del split-view (el panel de detalle no
  tenía ningún padding del lado derecho) se agregó separación real.
- **"[object Object]" en Ajustes → Estado de sincronización.** `error instanceof Error` daba
  falso para un `PostgrestError` de Supabase (un objeto plano, no una subclase de `Error`),
  así que caía a `String(error)` — que para un objeto da literalmente eso. Ahora se extrae
  `.message` de cualquier error con esa forma, no solo de instancias reales de `Error`.
- **Elegir la categoría antes de tipear el monto guardaba un movimiento en $0.** `canSave()`
  solo miraba que la expresión no estuviera vacía, nunca que el monto evaluado fuera
  distinto de cero. Ahora lo exige — y el chip de categoría rápida en el monto (que antes
  guardaba directo sin importar el monto) solo guarda directo si YA hay un monto tipeado;
  si no, deja la categoría marcada y espera a que se tipee el monto, ahorrando el paso
  extra solo cuando el orden (monto → categoría) lo permite.

## [0.9.29] — 2026-08-02

### Agregado/Corregido — borrar categorías, animación de sheets, un paso menos y duplicados en ingresos

- **Ajustes → Categorías suma un botón de borrar** (solo en las propias, nunca en las de
  sistema) — antes solo se podía editar nombre/ícono, no sacarla. Archiva, no borra (una
  categoría con movimientos históricos sigue existiendo para ellos); toast con "Deshacer" en
  vez de un diálogo de confirmación, porque hoy no hay otra forma de restaurarla desde la UI.
- **Toda hoja modal ahora entra y sale con una animación real** — antes `Overlay` desmontaba
  en el mismo frame en que se cerraba, sin nada que animar. Ahora "cerrado" es una fase más
  del ciclo de vida: al cerrar, el panel se sigue viendo un instante deslizándose/desvaneciéndose
  hacia afuera antes de salir del DOM de verdad. El cierre por arrastre (la sesión anterior)
  se integra con esto: si el gesto llega al umbral, el panel sigue el mismo recorrido en vez
  de saltar a 0 y recién ahí empezar a irse.
- **"Otras" en categorías pedía un paso de más** — tocar el chip de `AmountStep` mostraba de
  nuevo las 5 más usadas + "Otras" (la propia grilla que `CategoryStep` armaba antes de
  llegar a la grilla completa), redundante con lo que ya se había visto. Ahora entra directo
  a "Elegí una categoría" con el buscador y la grilla completa.
- **"Otras"/"Crear etiqueta" en Detalles** distingue si hay algo más detrás de las 5 más
  usadas: con más de 5 etiquetas en total dice "Otras" y abre la grilla completa; con 5 o
  menos (donde ya se ve todo) dice "Crear etiqueta" y va directo ahí con el buscador enfocado.
- **"Sueldo" y "Otros ingresos" seguían duplicados en la grilla completa** — el fix de la
  sesión anterior dedupeaba el top-5 de más usadas, pero la grilla con TODAS las categorías
  la seguía mostrando dos veces. Nuevo `dedupeCategoriesByIdentity`, aplicado antes de pasarle
  la lista a `CategoryStep` — sobrevive la fila con más uso real.

## [0.9.28] — 2026-08-02

### Agregado — etiquetar movimientos, de punta a punta

- **No había forma de ponerle una etiqueta a un movimiento.** El campo existía en el
  borrador de captura (`CaptureDraft.tagIds`) desde hace tiempo, pero no se leía ni se
  escribía en ningún lado — ni la UI, ni el guardado, ni la sincronización: la tabla
  `transaction_tags` tenía RLS lista desde el schema original pero cero camino de escritura
  desde el cliente.
- Primero en "Detalles" (antes de cuenta): las 5 etiquetas más usadas + "Otras", que
  despliega una grilla con todas y una opción para crear una nueva — misma lógica que
  categorías, pero multi-select (tocar prende/apaga, nunca cierra el sheet).
- Nuevo `transactionTagsRepo` (reemplaza el set completo de una vez, vía outbox) — la única
  tabla con clave compuesta en vez de `id`, así que `sync-worker.ts` suma un caso especial
  para el borrado (`transaction_id`+`tag_id` en vez de `.eq("id", ...)`). `save-transaction.ts`
  y `update-transaction.ts` ahora escriben las etiquetas del borrador al guardar/editar.
- Nuevo `rankTagsByUsage` (mismo patrón que las categorías) y los hooks para rankear y
  precargar etiquetas existentes al editar un movimiento.

## [0.9.27] — 2026-08-02

### Agregado — picker de categorías rediseñado: grilla completa, long-press para subcategorías

- **"Otro" pasa a "Otras" (plural — refiere a otras categorías) y ya no abre un buscador
  primero.** Ahora muestra una grilla con TODAS las categorías del `kind` actual más una
  burbuja para crear una nueva; el buscador sigue disponible arriba, sin autofocus, para
  cuando hay muchas.
- **Tap corto siempre selecciona la categoría general, mantener presionado ~500ms despliega
  las subcategorías** en una vista aparte (con volver) donde se puede confirmar la general o
  elegir una hija — antes tocar un padre con hijas expandía en el lugar y nunca lo
  seleccionaba directo. Las categorías con subcategorías llevan un punto violeta que indica
  que el long-press tiene algo detrás. `CategoryBubble` suma `onLongPress`/`hasChildren`.
- La burbuja "Agregar categoría" enfoca el buscador para escribir el nombre — ahí sí es
  intencional que aparezca el teclado, a diferencia de abrir el sheet.
- La edición de nombre/ícono que vivía en este picker se sacó: ya existe en Ajustes →
  Categorías (agregado la sesión anterior), que ve el household completo en vez de acotarse
  al `kind` de la captura en curso — un solo lugar para editar, no dos.

## [0.9.26] — 2026-08-02

### Agregado/Corregido — deslizar para cerrar en toda hoja modal, y scroll horizontal en Detalles

- **Toda hoja (`Sheet`) se puede cerrar deslizando hacia abajo**, no solo tocando afuera —
  el gesto se capta en una franja de 44px sobre la agarradera/título, no en el contenido, así
  que no compite con el scroll de una lista larga adentro. Se cierra pasado 120px de arrastre
  o con velocidad alta hacia abajo; si no llega, vuelve a su lugar con spring.
- **La hoja de "Detalles" de la captura tenía scroll horizontal en todo el módulo** — el
  panel del sheet no acotaba `overflow-x`, así que un hijo de ancho fijo (el carrousel de
  cuentas) podía abrir scroll lateral en el sheet ENTERO en vez de quedar contenido en su
  propio carrousel. `Overlay` pasa a `overflowX: "hidden"` en la variante `sheet` — el
  carrousel de cuentas y la tira de fechas, que sí necesitan desplazarse lateral, ya declaran
  su propio `overflowX` contenido y siguen funcionando igual.

## [0.9.25] — 2026-08-02

### Corregido/Agregado — idioma y tema en Ajustes, keypad de captura y monedas

- **Idioma y tema vuelven a Ajustes** — Perfil ahora es solo datos de la persona (nombre,
  email, fecha de nacimiento, país); esas dos preferencias de la app viven donde el resto de
  las preferencias.
- El botón "=" del keypad de captura quedaba 8px más alto que "Siguiente" (`--keypad-key-height`
  64px vs `--primary-button-height` 56px, compartiendo fila desde la versión anterior) — `KeypadKey`
  suma una prop `height` para que este uso puntual calce con el botón de al lado.
- **Después de resolver una cuenta con "=", seguir tipeando no hacía nada.** `amountToExpression`
  devolvía el resultado con la fracción completa rellenada ("25,00"), y como `appendToAmount`
  solo concatena texto, el siguiente dígito se perdía dentro de una fracción que
  `parseAmountString` ya trunca al tamaño fijo de la moneda — tipear "0" nunca cambiaba el
  monto mostrado. Ahora los ceros finales se recortan ("25,00" → "25"), así que seguir
  tipeando extiende la parte entera como se espera.
- **"Supermercado" seguía duplicado en las 5 más usadas** — el fix de la sesión anterior
  evitaba duplicados nuevos, pero households con datos de antes de ese fix podían tener dos
  filas vivas con el mismo `i18nKey`. `rankCategoriesByUsage` ahora dedupea también por
  identidad (`i18nKey` o nombre normalizado si no hay), no solo por `id`.
- El widget "usuarios por país" del panel de operador no tenía padding horizontal y mostraba
  el código de país en vez del nombre completo.
- **Monedas y tipos de cambio: se puede elegir la dirección de cada fila de la lista**, no
  solo dentro del editor — un botón chico al lado de cada par la invierte solo para mostrar
  (nunca toca lo guardado, que sigue siendo siempre la dirección canónica).

## [0.9.24] — 2026-08-02

### Agregado/Corregido — "=" comparte fila con Siguiente, resolver FX pendiente y tab bar de cuentas

- **"=" y "Siguiente"/"Guardar" comparten fila en `/add`**, ahorrando el alto de una fila
  entera de keypad. En reposo, "=" ocupa 1 columna y el botón 3; con una cuenta pendiente
  (`12+8` sin resolver), pasan a 2 y 2 con una transición animada, y vuelven al reparto
  original apenas se confirma con "=". `AmountStep` suma una prop `footerButton` para esto —
  el botón lo sigue armando el caller (`CaptureFlow`/`EditTransactionFlow`, con su propio
  `onConfirm`/`onComplete`), `AmountStep` solo le arma el lugar al lado de "=".
- **"Resolver tipos de cambio pendientes" (dentro de Cuentas) tenía el keypad sin conectar**
  — tocar la cifra no abría nada, la única forma de ajustar el rate era el slider ±5%. Es un
  componente distinto de `/currencies` a propósito (resuelve movimientos `pending`
  existentes en lote, algo que fijar un override no hace solo — CLAUDE.md § `needs_fx`), así
  que no se unificó con esa pantalla; se le wireó el mismo patrón de keypad que ya funciona
  bien ahí (`onOpenKeypad`, `operators={false}`, botón `Button` en vez de uno inline).
- **`/accounts` tenía el mismo problema visual de tab bar que `/transactions`** (la banda de
  despeje del FAB quedaba fija y pegada al tab bar en vez de formar parte del scroll,
  porque la pantalla usa su propio scroller interno en vez del de `<main>`) — mismo arreglo:
  el padding pasa a vivir dentro del scroller propio de la pantalla.

## [0.9.23] — 2026-08-02

### Corregido/Agregado — header, keypad "=", foco del picker, plantilla persistida, draft sucio y edición de categorías

- **El logo ocupa el hueco que dejaba el selector de ámbito oculto.** Con un solo miembro en
  el household ese espacio quedaba vacío en el header — ahora muestra el wordmark "PERZE"
  (la "Z" en violeta, `--primary-ink`), ya adaptado a claro/oscuro por token. Nota: esto
  contradice la regla cerrada de `CLAUDE.md` ("el logotipo no aparece dentro de la app") —
  se implementó igual porque el pedido fue explícito y puntual, pero queda señalado por si
  hace falta reabrir esa decisión más adelante.
- **El botón "=" del keypad se veía roto.** La fila que lo contiene (`gridColumn: 1 / -1`)
  estiraba bien el `<div>`, pero `KeypadKey` nunca le pasaba `width: 100%` al propio
  `<button>`, que quedaba angosto y pegado a un costado. Nueva prop `fullWidth` en
  `KeypadKey`.
- **El picker de categorías seguía levantando el teclado.** Dos causas superpuestas:
  `Overlay` enfocaba el primer elemento focuseable del panel al abrir, y ese elemento
  resultaba ser el buscador de texto (aunque ya no tuviera `autoFocus`) — ahora prefiere un
  control que no sea un `<input>` (botón, fila) y, si no hay ninguno, enfoca el panel mismo.
  Además, `Sheet` pasaba un `onClose` con una referencia nueva en cada render
  (`onClose ?? (() => {})`), lo que hacía que el efecto de foco de `Overlay` se
  re-ejecutara en CADA re-render mientras el sheet seguía abierto — desplegar las
  subcategorías de "Salud" disparaba un `setState` que volvía a robar el foco hacia el
  buscador. El `onClose` ahora vive en un `ref`, desacoplado de las dependencias del efecto.
- **La plantilla de categorías ("básica"/"completa") no se acordaba de la elección.** Vivía
  en un `useState` que arrancaba siempre en `"basic"`, sin leer nada guardado. Ahora se
  persiste en `households.settings` (jsonb, ya sincroniza a Supabase) — acompaña a la
  cuenta entre dispositivos, no queda solo en un navegador.
- **El botón "+" a veces arrancaba con un monto viejo en memoria.** El store del draft de
  captura es un singleton en memoria sin `persist`, así que sobrevivía a cualquier cierre
  que no pasara por el guardado exitoso o el botón de cancelar explícito — el backdrop del
  modal, un swipe-back, cambiar de tab. Ahora se reinicia una vez por cada montaje de
  `CaptureFlow`, así que tocar "+" siempre arranca en blanco sin importar cómo terminó la
  sesión anterior.
- **No había forma de editar nombre/ícono de una categoría desde Ajustes → Categorías** — la
  edición que se agregó la sesión pasada solo estaba enganchada al picker de "Otro" de la
  captura. Ahora la misma pantalla de plantillas lista las categorías propias del household
  con el mismo lápiz y la misma hoja de edición.

## [0.9.22] — 2026-08-02

### Agregado — tope de 80% para las hojas modales, y botón "=" con preview en la captura

- **Ninguna hoja modal pasa el 80% del alto útil.** `Overlay` (la primitiva detrás de
  `Sheet`) suma `max-height: 80dvh` a la variante `sheet` — aplica a las ~26 hojas de la app
  sin tocar cada una. Las dos de `/currencies` (donde el problema se notaba de verdad: el
  editor de tipo de cambio con el keypad abierto necesitaba scroll) pasan de un alto fijo en
  píxeles a `height="auto"`: crecen con su contenido y recién ahí, si hace falta, tocan el
  tope
- El teclado de tipo de cambio en `/currencies` ya no dibuja los operadores `+ − × ÷` —
  `rate-keypad.ts` los ignoraba al procesar la tecla, así que eran botones sin efecto. Nueva
  prop `operators` en `Keypad` (default `true`, sin cambios para el resto de los callers)
- **La captura de gasto suma un botón "=" y una vista previa de la cuenta que se está
  armando.** Antes, tipear "12+8" mostraba el resultado parcial en cada tecla — el héroe
  pasaba por 12 apenas se tocaba el "+", sin que se viera la cuenta en construcción. Ahora el
  héroe se congela en el último valor confirmado, aparece "12 + 8" debajo en una línea chica,
  y recién al tocar "=" se resuelve y reemplaza la expresión por el resultado plano. Nueva
  prop `equals` en `Keypad`, y `firstOperand`/`hasKeypadOperator`/`formatKeypadExpressionPreview`
  en `lib/money/keypad.ts`

## [0.9.21] — 2026-08-02

### Corregido/Agregado — categorías: duplicados, subcategorías desplegables y edición

- **"Supermercado" y "Otros ingresos" aparecían duplicados.** `applyCategoryTemplate` (el
  cambio de plantilla en Ajustes) archivaba solo las categorías de sistema sin uso y después
  recreaba la plantilla entera sin condición — cualquier categoría con movimientos ya
  cargados sobrevivía al archivado y le nacía un duplicado al lado. Ahora reconcilia por
  `i18nKey` (identidad estable de una categoría de plantilla): lo que ya existe, usado o
  archivado, no se vuelve a crear; una archivada que reaparece en la plantilla nueva se
  revive en vez de duplicarse
- Abrir "Otro" en el selector de categorías levantaba el teclado solo (`autoFocus`), tapando
  media lista antes de que el usuario llegara a tocar nada
- Las categorías con subcategorías (Salud → Farmacia/Consultas, Transporte → Nafta/etc.) se
  seleccionaban directo al tocarlas — no había forma de ver ni elegir una hija más
  específica. Ahora despliegan sus hijas en el lugar; la primera fila del grupo abierto es
  la categoría general, que sigue siendo seleccionable. Buscando, el árbol se aplana
- **Nuevo: editar nombre e ícono de una categoría propia.** No existía ninguna forma de
  hacerlo — ni siquiera el nombre, pese a que `categoriesRepo.update()` ya lo soportaba
  desde hace rato sin un solo caller real. Un lápiz en el picker de "Otro" (solo en
  categorías creadas por el usuario, nunca en las de sistema) abre una hoja chica con
  nombre + una grilla de 16 íconos curados
- Los chips de categorías frecuentes en la captura de gasto no truncaban — con nombres
  largos ("Supermercado", "Entretenimiento") el set de 5 + "Otros" pasaba a 3 filas en un
  teléfono angosto. `Chip` suma un `maxWidth` opcional con elipsis (el ícono nunca se
  recorta, el nombre completo queda en el `title`)

## [0.9.20] — 2026-08-02

### Corregido — precisión del tipo de cambio manual y selector de ámbito con un solo miembro

- **En `/currencies`, modo invertido, tipear "1500" guardaba "1499,99999925".**
  `manualRate` se guardaba siempre en la dirección canónica y se volvía a invertir cada vez
  que había que mostrarlo — `invertRate()` redondea porque casi ningún recíproco termina, y
  aplicarlo dos veces en el mismo round-trip (al guardar y de nuevo al mostrar) componía el
  error. Ahora el estado vive en la dirección que se está mostrando y la única inversión de
  todo el flujo pasa a `handleSaveOverride`, una sola vez, justo antes de persistir
- `parseRate()` truncaba en silencio cuando el usuario tipeaba más de los 12 decimales que
  entran en `numeric(24,12)` — ahora redondea (half-even) el último dígito, como pide la
  regla de nunca perder precisión sin avisar
- El slider ±5% de `FxEditor` calculaba el ajuste con `Number()` y `.toFixed(12)` — el único
  camino de punto flotante que quedaba sobre un rate. Pasa a aritmética `bigint` completa;
  el único `Number` que sobrevive es la posición del propio `<input type="range">`, que no
  tiene otra forma de recibirla
- El segmentado Personal/Compartido/Todo del header se dibujaba siempre, incluso con un solo
  miembro en el household — no hay nada que discriminar. Ahora se oculta con
  `useHouseholdMembers`, y se resuelve a `false` (no a un estado intermedio) mientras la
  query carga, para que no aparezca y desaparezca al montar

## [0.9.19] — 2026-08-02

### Corregido — la cifra héroe nunca encogía (`fit` no funcionaba), chevron de volver y tab bar

- **El mecanismo `fit` de `Amount` nunca funcionó, en ningún lado.** El `<span>` interno que
  mide el ancho del texto no tenía `display` explícito — quedaba `inline`, y una caja
  `inline` da `scrollWidth: 0` en Blink/WebKit al medirla desde JS. `fitScale()` recibía
  siempre 0 y devolvía la escala anterior (1) sin cambios: los números nunca se encogían,
  se cortaban por los bordes cuando no entraban. El arreglo es una línea (`display:
  inline-block` en el span medido) más una nueva prop `fitFloor` para pisos custom — el
  keypad de captura (`AmountScrubber`, sin cota superior en la cifra que el usuario está
  tecleando) pasa a un piso de 35% en vez del 55% general, para que un monto de 9+ dígitos
  siga entrando completo en un teléfono angosto
- El chevron de "volver" en el detalle de un movimiento no hacía nada visible: usaba
  `router.push("/transactions")` hacia una ruta que ya estaba montada por detrás del slot
  interceptor `@detail`, así que Next no desmontaba nada pero sí apilaba una entrada en el
  historial — de ahí que el gesto de volver necesitara después dos swipes en vez de uno.
  Ahora usa `router.back()`, el mismo patrón que el resto de las pantallas interceptadas
- El tab bar no tenía separación visual del fondo de la página (mismo color) — ahora lleva
  un hairline superior. Y en `/transactions` específicamente se veía más alto que en el
  resto: su scroller virtualizado llena exacto la caja de `<main>` y por eso nunca scrollea
  a través del padding de despeje del FAB, que quedaba como una banda fija pegada al tab
  bar. Ese padding pasa a vivir dentro del propio scroller de la pantalla en vez de en
  `<main>`, igual que en el resto de las pantallas
- La fecha de nacimiento del perfil seguía desbordando el ancho de la página. El arreglo
  anterior (`minWidth: 0` en el `<label>` de `Input`) partía de un diagnóstico equivocado —
  ese contenedor es flex en columna, y `min-width` solo gobierna el eje principal, que ahí
  es el vertical. La causa real es que `input[type="date"]` trae su propio ancho mínimo en
  WebKit/Blink que ignora `width: 100%`; el arreglo va sobre el control mismo, en
  `globals.css`

## [0.9.18] — 2026-08-02

### Corregido — navegación lenta entre tabs en la PWA instalada

- Tocar un tab (Inicio → Movimientos) no daba ningún feedback hasta que la navegación
  commiteaba: la `TabBar`/`Sidebar` usaban `<button onClick>` + `router.push`, sin prefetch,
  sin press state, sin un solo `loading.tsx` en todo el repo. Ahora `TabItem` lleva `href` y
  se renderiza como `<Link prefetch>` (con fallback a `<button>` donde no hay `href`, p. ej.
  `/dev/components`): las cuatro rutas quedan prefetcheadas apenas hidrata la tab bar, el tab
  tocado se pinta activo en el mismo frame (activo optimista, se descarta solo cuando el
  pathname real lo alcanza), y cada ruta de tab tiene su propio `loading.tsx`
- `proxy.ts` hacía `supabase.auth.getUser()` — un round-trip al Auth server — más un `SELECT`
  a `profiles` en CADA navegación, antes de que Next empezara a renderizar. El proyecto ya
  firma con JWT asimétrico (ES256), así que pasa a `getClaims()` (verificación local del JWT,
  sin red) y cachea el resultado de `access_status` en una cookie httpOnly de 15 minutos
  atada al `userId`; revocar un acceso ahora tarda hasta ese TTL en expulsar a alguien ya
  navegando — RLS sigue siendo la barrera real, esto es solo el gate de UX
- El sync loop invalidaba TODO el cache de TanStack Query cada 30 segundos
  (`queryClient.invalidateQueries()` sin key), tirara o no el pull una sola fila nueva —
  incluidas queries con `staleTime: Infinity` como el household actual. Ahora solo invalida
  cuando el pull trajo transacciones nuevas o detectó borrados, y nunca toca lo que
  `pullFromRemote` no puede haber tocado (sesión, inversiones). `staleTime`/`gcTime` del
  `QueryClient` pasan a 5 min / 24h — la fuente de verdad es Dexie local, no un servidor
  remoto, así que volver a un tab ya no muestra el skeleton de vuelta solo por haberse
  quedado quieto
- El service worker no tenía `networkTimeoutSeconds` en las reglas de navegación/RSC: con
  señal pobre, una navegación esperaba a la red sin límite en vez de caer al cache. Ahora cae
  en 3 segundos; el prefetch de rutas usa `StaleWhileRevalidate` (nunca bloquea), y las
  respuestas de Supabase quedan `NetworkOnly` explícito en vez de caer en el bucket genérico
  `cross-origin` que las cacheaba hasta 1 hora
- `design-system/index.ts` reexportaba `charts` (13 componentes SVG) y `systems` desde el
  barril raíz: cualquier pantalla que solo necesitaba `Card`/`Skeleton` arrastraba el grafo
  completo. Ahora se importan directo desde `@/design-system/charts`/`@/design-system/systems`
  donde se usan; `next.config.ts` suma `optimizePackageImports` para `@phosphor-icons/react`,
  `motion` y `date-fns`
- El arranque en frío de la PWA quedaba con un spinner hasta que `getUser()` resolvía por
  red. Ahora resuelve primero con `getSession()` (local, sin red) y confirma con `getUser()`
  en segundo plano, sin bloquear el primer paint

## [0.9.17] — 2026-08-02

### Agregado — historial de tipo de cambio: promedio mensual

- Base para métricas/gráficos de tendencia a lo largo del tiempo (pedido explícitamente para
  después, no para esta sesión) — no un registro diario perfecto, un promedio por mes
  alcanza. Resulta que ya existía un cron diario (`daily-fx-sync`, E20) juntando una foto de
  `fx_rates` todos los días — no hizo falta un snapshot semanal nuevo, el promedio mensual
  se calcula agregando lo que esa tabla ya junta sola
- Tabla nueva `fx_rate_monthly_averages` (Patrón C, igual que `fx_rates`/`price_snapshots`:
  lectura para todo autenticado, escritura solo por el cron) + función
  `compute_fx_monthly_averages()`, programada a diario a las 9:10 UTC, justo después del
  sync existente. Un solo `quote_kind` por par ("oficial"/"default", la misma referencia que
  ya usa el resto de la app) — promediar oficial/blue/mep/ccl juntos mezclaría cotizaciones
  que no son la misma cosa
- Nuevo `fxRateHistoryRepo.monthlyAverages(base, quote)` del lado cliente, listo para
  cuando se construya la pantalla que lo consuma — ninguna pantalla lo usa todavía

## [0.9.16] — 2026-08-02

### Corregido — filtrar por "gasto" en movimientos ponía "ingresos" en 0

- El resumen "Ingresos/Gastos/Balance" se calculaba de la misma lista ya filtrada por
  tipo/cuenta/categoría/pendientes que alimenta el listado — filtrar por "gasto" vaciaba
  la lista de ingresos a cero, y el resumen mostraba eso literal. El resumen ahora es del
  PERÍODO (solo respeta el rango de fecha, mismo concepto que "gastado este período" del
  home); el resto de los filtros narrowean qué se ve en la lista, nunca el resumen

## [0.9.15] — 2026-08-02

### Agregado — color de identidad por cuenta

- `accounts.color` ya existía en el schema (columna sin usar desde siempre) — sin migración.
  El formulario de cuenta suma un picker de 12 colores (grilla que se reacomoda sola según
  el ancho de pantalla); default sin elegir sigue con el `--surface-2` neutro de siempre. Los
  primeros 5 son los mismos slots de datos ya validados por contraste/daltonismo
  (`--data-1..5`); los 7 restantes son una extensión de una sola pasada, sin la misma
  validación formal — señalado en el propio código para una auditoría de color futura
- El color pinta el fondo del ícono en todos los lugares que YA dibujaban uno: lista de
  cuentas (mobile y desktop) y el selector de cuenta de la captura. El carrusel del home y
  el header de detalle de cuenta no tienen ícono hoy — agregarles uno queda fuera de este
  cambio, es una pieza de diseño aparte
- `ListRow` suma `iconBackground` (opcional, default sin cambios) — con un fondo propio el
  glifo pasa a blanco para contraste, mismo criterio que ya usaba `InstitutionTile`

## [0.9.14] — 2026-08-02

### Corregido — el detalle de cuenta ocupaba el 100% del ancho sin control en mobile

- Mismo caso que el detalle de movimiento, pero del lado del padding/ancho máximo en vez del
  fondo: el detalle de cuenta no usa `ScreenShell` (asume el centrado y el padding lateral
  que le da `(app)/layout.tsx` normalmente), así que interceptado en `Modal` quedaba pegado
  borde a borde. Nueva prop `contained` en `Modal` — replica el padding y el
  `--content-max-width` centrado que la pantalla pierde al salir del shell. Se activa en los
  dos detalles que lo necesitan (cuenta, movimiento); `/add` y `/accounts/new` quedan igual
  que antes porque ya se centran solos vía `ScreenShell`

## [0.9.13] — 2026-08-02

### Agregado — separador decimal y formato de fecha configurables en Ajustes

- Dos preferencias nuevas, con ejemplos en vivo al elegir: separador decimal (coma/punto/según
  el idioma) y formato de fecha numérica (DD/MM/AAAA, MM/DD/AAAA, AAAA-MM-DD, según el
  idioma). Puramente de visualización — nunca tocan cómo se guarda un monto o una fecha
- El separador decimal se resuelve centralizado en `decimalSeparatorForLocale`, así que
  todo lo que ya pasaba por ahí (`Amount`, `Keypad`, `FxEditor`, `RateRow`, `/currencies`) lo
  respeta sin tocar esos ~20 call sites uno por uno
- El formato de fecha numérica es nuevo (`formatNumericDate`) — la mayoría de las fechas de
  la app son "narrativas" a propósito (nombre de mes/día, no números) y esa elección de
  diseño no cambia; se aplicó a las dos pantallas que sí mostraban una fecha puramente
  numérica (actividad de familia, panel de admin)

### Cambiado — "Habilitar más funciones" pasa a vivir dentro de Ajustes

- Antes era una entrada suelta al final de "Más". Ahora es una fila más de Ajustes, junto al
  resto de las preferencias del household

### Corregido — desborde horizontal en el home y en el input de fecha del perfil

- Las cards de "gastado"/"ingresado este período" ya tenían el clamp de tamaño de texto,
  pero el `<button>` que las envuelve es un ítem flex sin `minWidth: 0` — por default no
  encoge por debajo del ancho intrínseco de su contenido, así que la fila entera (y la
  página) se forzaba más ancha que la pantalla aunque el texto de adentro ya se hubiera
  achicado. Mismo bug en el input de fecha de nacimiento del perfil (`type="date"` puede
  tener un ancho intrínseco grande): se agrega `minWidth: 0` al `<label>` raíz de `Input`,
  así queda blindado en cualquier pantalla que lo use dentro de un contenedor flex, no solo
  en el perfil

### Corregido — cargar un tipo de cambio a mano completaba/redondeaba el valor tipeado

- El campo de texto para una tasa sin cotización sugerida pasaba lo tipeado por `Number()` +
  `.toFixed(12)` antes de guardarlo — la regla que el proyecto prohíbe para plata y tasas.
  Nuevo `parseTypedRate` parsea el string tal cual, sin pasar por punto flotante: "1500.00"
  queda exactamente 1500, "0.0023478" queda exactamente eso, nunca se completa ni redondea

## [0.9.12] — 2026-08-02

### Corregido — el tipo de cambio se cortaba a 2 decimales, incluso cuando eso perdía precisión

- Con el toggle de dirección invertible (v0.9.11), una tasa como "1 ARS = 0,00064 USD" se
  mostraba y editaba como "0,00" — el corte fijo a 2 decimales servía para tasas grandes
  pero rompía cualquier tasa chica. Nuevo `formatRateTrimmed` (reemplaza `formatRateShort`,
  eliminado): muestra la precisión completa pero saca los ceros finales que no aportan nada
  ("1560,000000000000" → "1560"; "0,025000000000" → "0,025"; una tasa chica como
  "0,000641025641" se sigue leyendo entera). Aplica al número héroe de `FxEditor`, al
  prefill del teclado numérico, a `RateRow` (lista de `/currencies`) y al "tipo de cambio
  usado" del detalle de movimiento — de paso este último deja de ignorar el separador
  decimal del locale

## [0.9.11] — 2026-08-02

### Agregado — `/currencies`: código libre, catálogo real de Frankfurter y dirección invertible

- **Catálogo de "agregar moneda" ampliado**: antes solo se podía elegir entre las 7 monedas
  del picker de cuentas. Ahora suma las 30 que realmente cubre el proveedor `frankfurter`
  (antes su `SUPPORTED` estaba recortado a 14 de esas 30 sin motivo — dolarapi sí tiene un
  recorte deliberado a Argentina, este no lo era). Al elegir una, se intenta resolver un rate
  sugerido al toque (en vez de arrancar siempre en 1:1) si el proveedor cubre el par
- **Código de moneda libre**: además del catálogo, un campo de texto acepta cualquier código
  (2-10 letras/números, mismo patrón que ya valida `/api/fx`) para lo que ningún catálogo
  lista — cripto, USDT, etc. — igual que ya funcionaba el override manual sin esto
- **Dirección de tasa invertible**: un segmentado deja elegir si tipear "1 USD = ? ARS" o
  "1 ARS = ? USD", lo que sea más cómodo — se invierte antes de guardar, el par almacenado
  nunca cambia de sentido
- Migración `20260802040000_seed_frankfurter_currencies.sql`: sube el catálogo global
  `currencies` (Patrón C) a la cobertura real de Frankfurter — sin esto, `/api/fx` rechazaba
  con `MONEDA_DESCONOCIDA` cualquier código fuera de los 7 sembrados originalmente, sin
  importar que el proveedor sí tuviera el par

## [0.9.10] — 2026-08-02

### Cambiado — reorganización de "Más": Perfil agrupa identidad, Sync se fusiona, Datos y backup se fusiona

- **Tema claro/oscuro/sistema** tenía toda la infraestructura (`THEME_STORAGE_KEY`, script
  anti-flash) pero cero control de usuario — el tema era 100% del sistema operativo. Nuevo
  selector en Perfil (`lib/theme/apply-theme.ts` + `use-theme-preference.ts`), aplicación
  inmediata sin remount
- **Perfil** (K2) ahora agrupa lo que antes vivía suelto en el índice de Más — decisión de
  producto explícita: nombre (editable), email (solo lectura, es el dato de identificación de
  `auth.users`, cambiarlo requiere confirmación y queda fuera de alcance), país (editable,
  aplica al toque), **fecha de nacimiento** (nueva, opcional, solo para estadística agregada —
  columna `profiles.birth_date`, migración `20260802030000_profile_birth_date.sql`), idioma y
  tema (movidos desde el índice de Más)
- **Sync** — "Conflictos" y "Estado de sincronización" eran dos pantallas separadas sin
  cruzarse; ahora una sola (`/more/sync`) con dos secciones apiladas: conflictos pendientes
  arriba solo si los hay, diagnóstico del outbox siempre abajo. `/more/conflicts` se elimina
- **Datos y backup** — "Exportar backup" e "Importar CSV" eran dos filas sueltas; ahora un
  hub (`/more/data`) con dos accesos a las mismas pantallas (`/more/export`, `/more/import`),
  sin tocarlas
- **Instalar app** — Ajustes (K3) tenía una promesa sin cumplir ("Podés instalarla más tarde
  desde Ajustes", copy del onboarding) y ningún botón real. Nuevo: detecta plataforma
  (iOS/Android/macOS/Windows) y usa el prompt nativo del navegador cuando está disponible, o
  instrucciones específicas por plataforma cuando no. El listener de `beforeinstallprompt` se
  centralizó (`pwa-store.ts` + `PwaInstallListener`, montado una vez en `Providers`) — antes
  vivía duplicado en el flujo de onboarding (A10), ahora ambos puntos de entrada comparten el
  mismo evento capturado
- **Nota:** verificado con `pnpm build`/`lint`/`test` limpios y probado en el navegador con
  datos demo (índice de Más, Ajustes, Sync, Datos y backup). Perfil no se pudo probar
  interactivamente ahí porque el modo demo no tiene sesión real de Supabase — comportamiento
  preexistente de `useCurrentUserId()`, no algo que cambió acá; con una cuenta logueada de
  verdad debería andar normal

## [0.9.9] — 2026-08-02

### Agregado — "gastado"/"ingresado este período" también respetan el toggle de moneda del home

- El toggle base⇄USD del patrimonio neto ahora también convierte los dos `StatTile` de
  "gastado"/"ingresado este período" — antes solo se aplicaba a la cifra héroe. Mismo criterio
  de `needs_fx`: si no hay cotización hoy, cada tile cae a la moneda base sin inventar un valor

## [0.9.8] — 2026-08-02

### Agregado — clamp de tamaño en "gastado"/"ingresado este período" del home + clickeables

- Mismo mecanismo del patrimonio (`ResizeObserver` + `fitScale`, piso de legibilidad al 55%),
  ahora también en los dos `StatTile` del home. No pasan por `<Amount>` (usan
  `formatAmountCompact`, que abrevia — "$ 1,2 M" — algo que `Amount` no sabe hacer), así que
  se extrae el clamp a un componente local (`FitStatValue`) en vez de forzarlo dentro de
  `Amount`
- Las dos cards ahora navegan a `/transactions` filtrado por tipo (gasto/ingreso) y por el
  inicio del período del household — mismo `periodStartDay` que ya usaba el cálculo de
  "este período", no el mes calendario. `transactions/page.tsx` suma soporte para
  `?kind=&from=&to=` como deep link, mismo patrón que ya tenía para `?category=`/`?payee=`
  del buscador

## [0.9.7] — 2026-08-02

### Corregido — el detalle de movimiento se veía encimado con la lista en mobile

- `Modal` (`position: fixed; inset: 0`) no tenía color de fondo — funcionaba bien para
  `/add` y `/accounts/new` porque esas pantallas pintan el suyo propio vía `ScreenShell`,
  pero el detalle de movimiento no usa `ScreenShell` (asume el fondo de `(app)/layout.tsx`,
  de donde normalmente vive). En mobile, `transactions/layout.tsx` apila lista y detalle en
  el mismo DOM (`<>{children}{detail}</>`) — sin un fondo sólido en el medio, el texto de
  la lista de atrás se transparentaba a través del modal. Se agrega `background: var(--page)`
  al `Modal` compartido (y `overflowY: auto` para contenido más alto que el viewport, que
  antes no tenía scroll propio) — beneficia a las tres rutas que lo usan, no solo a esta

## [0.9.6] — 2026-08-02

### Corregido — el monto se salía de la pantalla en `/add` con números grandes

- `AmountScrubber` (la cifra arrastrable de C1, `hero-xl` 64px) quedó afuera cuando se agregó
  la prop `fit` a `Amount`: su contenedor era `inline-flex`, que se ajusta al contenido y
  nunca puede medir cuánto espacio hay disponible — nada contra qué encoger. Pasa a `flex` +
  `width: 100%` y usa `fit` con `style={{ width: "90%" }}`: el 10% restante es el padding
  fijo a los costados que pide `fit`, con el mismo piso de legibilidad (55% del tamaño
  nominal) que ya usan el patrimonio del home y de `/accounts`

## [0.9.5] — 2026-08-02

### Corregido — PWA instalada rota en iPhone con isla dinámica (safe areas)

- La tab bar inferior desbordaba sus íconos y solapaba el FAB en cualquier equipo con
  `safe-area-inset-bottom` (iPhone con isla dinámica/notch, PWA instalada): `TabBar.tsx`
  fijaba `height: 64px` y además `paddingBottom: env(safe-area-inset-bottom)` sobre
  `box-sizing: border-box`, así que el inset (34px en iPhone 16 Pro) se restaba del alto en
  vez de sumarse — la caja de contenido real quedaba en ~30px para un ícono de 22px + label.
  `docs/02-design-system.md` § 4 ya documentaba "Tab bar 64px + safe area"; el código
  implementaba lo contrario. Nuevo token `--tabbar-total-height` (`--tabbar-height` + safe
  area) resuelve la caja a 64px reales en cualquier equipo; `--tabbar-height` no cambia de
  valor porque `globals-tokens.test.ts` lo assertea contra el doc
- El alto de pantalla tampoco se ajustaba al área utilizable: `viewport-fit: cover` +
  `statusBarStyle: "black-translucent"` extienden el layout bajo la isla dinámica, pero
  `env(safe-area-inset-top)` no se usaba en ningún lugar del repo — el header y ~59px de
  contenido quedaban tapados. `.app-shell` ahora absorbe el inset superior una sola vez;
  las pantallas full-screen fuera del shell de `(app)` (`ScreenShell`, `LockScreen`,
  `/offline`, el loader de `onboarding-gate`) suman el mismo inset a su padding superior
- El `<main>` del shell de `(app)` restaba `var(--tabbar-height) + 24px` de su alto de
  scroll aunque la tab bar es un hermano flex, no un overlay — quedaban ~88px de scroll
  muertos abajo de cada pantalla; ahora solo deja aire para el voladizo del FAB
- Splash screens de iOS (`apple-touch-startup-image`): faltaban las entradas de iPhone 16
  Pro y 16 Pro Max en la tabla de dispositivos, así que esos equipos no matcheaban ninguna
  media query y el arranque de la PWA mostraba una pantalla lisa en vez del splash — se
  agregaron y se regeneraron los 4 PNG (`scripts/generate-splash-screens.mjs`)
- **Nota:** todo esto se verificó con `pnpm lint`/`pnpm test`/`pnpm build` limpios y con
  `env()` inspeccionado a mano contra los insets documentados de iPhone 16 Pro (59px top,
  34px bottom) — la validación real en el dispositivo, con la PWA reinstalada para
  descartar HTML/CSS cacheado por el service worker, queda pendiente

## [0.9.4] — 2026-08-02

### Agregado — captura por voz determina tipo y categoría, no solo el monto

- "Gasté 2500 en transporte" solo cargaba el monto — el parser (`parse-voice.ts`) nunca
  intentó determinar el tipo de movimiento ni matchear una categoría; "transporte" quedaba
  como texto libre en el campo de comercio, sin comparar contra nada. Ahora detecta el tipo
  por el verbo (gasté/pagué/compré → gasto; cobré/recibí/ingresé → ingreso; transferí →
  transferencia) y matchea el texto capturado contra el nombre de las categorías del
  household (sin acentos/mayúsculas, en cualquiera de los dos sentidos)
- El resumen de la hoja de voz ahora muestra tipo y categoría interpretados, además de monto
  y comercio, antes de aplicar — la confirmación real sigue siendo el paso normal de captura
  (toggle de tipo + chip de categoría + el botón "Guardar" de siempre), así que un acierto
  parcial nunca bloquea ni fuerza un dato mal interpretado

### Corregido — un error de voz quedaba completamente silencioso

- `onerror` descartaba el evento entero y solo apagaba el estado de "escuchando" — sin
  distinguir "navegador sin soporte" de "soportado pero falló" (permiso de micrófono
  denegado, sin micrófono, sin red, no se entendió nada). El código de error real ahora se
  mapea a un mensaje específico y se muestra en la hoja; también se agrega un `try/catch`
  alrededor de `recognition.start()` para que un fallo síncrono no deje el botón colgado.
  **Nota:** esto da diagnóstico donde antes no había nada, pero no puedo confirmar sin
  probar en el dispositivo real si el permiso de micrófono es justo lo que está fallando en
  la PWA instalada — `docs/plan-de-trabajo.md` (CONS-C09) ya marcaba el soporte de Web
  Speech API fuera de una pestaña de escritorio como sin verificar

## [0.9.3] — 2026-08-02

### Corregido — la sesión por contraseña no sobrevivía a cerrar la PWA instalada

- Login por email+contraseña era el único camino de auth de la app que nunca pasaba por el
  servidor: `signInWithPassword` corría en el cliente y la cookie de sesión se escribía por
  `document.cookie`. OAuth, magic link y OTP ya canjean su sesión en `/auth/callback` (Route
  Handler, `Set-Cookie` real) — password quedaba afuera de ese camino. Una cookie escrita
  solo por script queda sujeta al recorte de vida real que aplican Safari/WebKit (y las PWA
  standalone que corren sobre ese motor) sin importar el `Max-Age` pedido, que es
  exactamente el síntoma reportado: funciona después de loguearse, pero al cerrar y reabrir
  la PWA instalada vuelve a pedir contraseña en vez de restaurar la sesión
- Nueva Server Action `signInWithPasswordAction` (`src/features/auth/sign-in-with-password.action.ts`):
  mismo `signInWithPassword`, corriendo del lado del servidor con el cliente de
  `next/headers` `cookies()`, así la sesión sale como `Set-Cookie` real. `/login` la usa en
  vez de la versión de cliente
- El bloqueo por PIN (opcional) no se toca — sigue gateando con sesión viva, independiente
  de esto

## [0.9.2] — 2026-08-02

### Agregado — cambiar la moneda base desde Ajustes

- "Moneda base" en Ajustes llevaba a `/currencies`, una pantalla que solo edita tipos de
  cambio contra la base — no existía ningún control para cambiar la base en sí. Ahora abre
  un picker propio. Solo se ofrece si el household **todavía no cargó ningún movimiento**:
  `fx_rate`/`amount_base` se congelan para siempre en cada transacción, así que cambiar la
  base con movimientos ya cargados dejaría el histórico mezclado en dos monedas sin aviso.
  Con movimientos, la fila queda deshabilitada con una nota explicando por qué. La fila
  separada "Tipos de cambio" (multi-moneda) sigue yendo a `/currencies` sin cambios

### Corregido — dos opciones para lo mismo en el login del onboarding

- A2 tenía "Prefiero usar mi contraseña" (togglea un campo de contraseña en la misma
  pantalla) y "Ya tengo cuenta" (navega a `/login`) — dos caminos al mismo destino
  (`signInWithPassword`). Se elimina el primero: el mock de A2 es explícitamente sin
  contraseña ("no hay contraseñas, ni acá ni nunca"), y `/login` ya cubre ese caso con más
  contexto (incluida la recuperación de contraseña, que el toggle inline no ofrecía)

## [0.9.1] — 2026-08-02

### Agregado — E6 completa: agregar moneda, teclado numérico y "Actualizar" real

- **"Agregar una moneda"**: hasta ahora `/currencies` solo listaba las monedas que ya
  respaldaban una cuenta — no había forma de trackear un par sin tener una cuenta en esa
  moneda. Ahora una fila de acción abre el catálogo completo (`CURRENCIES`) y, al guardar un
  override manual para un par nuevo, ese par persiste y reaparece solo (nuevo
  `fxRepo.listOverrideCurrencies`)
- **Teclado numérico en el editor de tipo de cambio**: `FxEditor` ya tenía el número héroe y
  el slider de ajuste fino ±5%, pero tocarlo no abría nada (`onOpenKeypad` sin conectar en
  ningún lugar de la app). Se agrega el ícono de lápiz junto al número y se conecta un
  teclado numérico real (dígitos + separador decimal + backspace, sin operadores — un tipo
  de cambio no es una cuenta) que después vuelve al slider para el ajuste fino
- **"Actualizar" ahora fuerza la red de verdad**: antes `invalidateQueries` solo
  recalculaba desde el mismo cache local — `fxRepo.resolve` solo pegaba a `/api/fx` cuando
  el estado era `pending` o `inherited` de hoy. Nuevo parámetro `forceRefresh` que salta esa
  condición (el override manual sigue ganando siempre, esto nunca lo pisa), con spinner y
  toast de resultado

### Corregido — "tipo de cambio usado" mostraba 12 decimales

- El detalle de un movimiento mostraba `1 USD = 1560.000000000000 ARS` — `formatRate` es el
  formateador interno (12 decimales, `numeric(24,12)`), nunca pensado para mostrarse al
  usuario, y su propio comentario ya lo decía. Nuevo `formatRateShort` (trunca a 2
  decimales, mismo criterio que ya usaba `RateRow`) reemplaza el uso directo en el detalle
  de transacción y en `RateRow`

### Corregido — la fila de cuenta en el detalle de movimiento no mostraba la moneda

- Mostraba solo el nombre ("Itaú"); ahora suma el código de moneda ("Itaú · USD"), relevante
  para households con cuentas en más de una moneda

### Agregado — toggle para ver el patrimonio neto del home en USD

- Nuevo segmentado (superficie neutra, no compite con el violeta del scope switcher) junto
  al ícono de privacidad: alterna la cifra grande de "Patrimonio neto" entre la moneda base
  y USD. Preferencia persistida por dispositivo (Zustand + `persist`, mismo patrón que el
  modo privacidad). Solo la cifra grande — el delta semanal y el sparkline se quedan en
  moneda base, porque convertirlos pediría cotización histórica día a día. Si no hay
  cotización base→USD hoy, cae a la moneda base y avisa — nunca inventa un valor

## [0.9.0] — 2026-08-02

### Agregado — sincronización incremental multi-dispositivo (AC-14)

- Diseño cerrado en `docs/plan-sync-incremental.md` desde v0.8.3, implementado en las tres
  fases previstas. Hasta ahora la app solo bajaba datos del servidor una vez, al entrar en un
  dispositivo sin datos (`hydrate.ts`): después de eso, un segundo dispositivo nunca volvía a
  mirar el servidor y un cambio hecho en el teléfono no aparecía en la tablet sin restaurar
  manual. Cubre el multi-dispositivo *simultáneo* que la hidratación no resolvía
- **F1 — el pull incremental (`pull.ts`).** `transactions` (la única tabla sin cota de tamaño)
  se trae por cursor, paginado por keyset sobre `(updated_at, id)` — no por offset, que puede
  saltear una fila que entra al conjunto mientras se pagina — con un watermark en `meta` que
  guarda 5 segundos de solape contra el skew de reloj entre dispositivos. El resto de las
  tablas (households, members, accounts, categories, tags, payees, budgets, goals,
  recurring_rules, rules) se refrescan completas en cada ciclo y podan localmente lo que ya no
  vino del servidor — con la excepción de cualquier fila que tenga una entrada en el outbox
  local, que nunca se pisa ni se poda: está en camino al servidor o esperando resolución
  explícita de un conflicto. `accounts.currentBalance` tiene además su propia excepción:
  mientras el outbox tenga una transaction pendiente, el saldo remoto puede estar calculado
  sin ella todavía, así que no se pisa el valor local hasta que esa cola se vacíe. Nueva
  migración: índice `transactions_household_updated_idx (household_id, updated_at, id)`
- **F2 — cableado al ciclo de sync.** `use-sync-loop.ts` corre el pull siempre que hay un
  household activo, sin importar si el outbox local tiene algo pendiente (a diferencia del
  push): un dispositivo que solo lee tiene el outbox vacío por definición, y antes el pull
  hubiera quedado sin correr nunca ahí. Push primero, pull después, mismo tick de 30s
- **F3 — Realtime como atajo de latencia (opcional).** Suscripción `postgres_changes` sobre
  `transactions` filtrada por household, con el pull de 30s como red de seguridad para
  reconexiones y eventos perdidos — nunca aplica el payload del evento directo, solo dispara
  el mismo `pullFromRemote`. Nueva migración: `REPLICA IDENTITY FULL` + alta en la publication
  de `transactions`; sin policy de RLS nueva, `tx_select` ya filtra los eventos por household,
  visibilidad y `can_see` de la cuenta

## [0.8.5] — 2026-08-02

### Corregido — `/more/categories` no scrolleaba (A8)

- Mismo bug de `min-height: auto` en un hijo flex de columna que ya se había corregido en
  `/accounts` y `/transactions`: el contenedor de las tres opciones no tenía `minHeight: 0`
  ni `overflowY: auto`, así que si el contenido no entraba en la pantalla quedaba
  inalcanzable. Ahora el contenido scrollea en su propio contenedor y el botón "Guardar"
  queda fijo abajo, fuera del área de scroll

### Agregado — vista previa de categorías y subcategorías por plantilla (A8)

- Las tres opciones ("Básica", "Completa", "Empezar de cero") solo mostraban un conteo
  ("21 categorías") sin decir cuáles son. La opción seleccionada ahora despliega los
  nombres reales: las categorías con subcategorías (Supermercado, Transporte, Salud en
  "Completa") en su propia línea con las hijas debajo, el resto agrupado en una línea final

## [0.8.4] — 2026-08-02

### Corregido — "Nueva cuenta" no abría nada (E3)

- Desde `/accounts`, tocar "Nueva cuenta" cambiaba la URL a `/accounts/new` pero la pantalla
  no cambiaba: el interceptor de detalle `accounts/@detail/(.)[id]` se quedaba con la
  navegación blanda y trataba `"new"` como si fuera un id de cuenta. Se agregó la
  interceptora `@modal/(.)accounts/new` (mismo patrón que `/add`) y una guarda en
  `@detail/new` para que el interceptor de `[id]` deje de reclamarlo — el formulario (E3.1/E3.2,
  ya programado) ahora abre como modal sobre la lista, con back nativo
- `/accounts/new` por navegación dura (deep link) ya no queda en blanco mientras resuelve
  sesión, ni para siempre si no hay sesión: muestra skeleton mientras carga y redirige a
  `/login` cuando no hay usuario

### Corregido — la cifra de "Patrimonio neto" se salía de la pantalla

- Con un monto de varios millones, la cifra héroe del home (`hero-xl`, 64px, mono) medía más
  que el ancho del teléfono y se recortaba por los dos lados. El home usaba `hero-xl` +
  `tabular` en contra de lo que ya mandaba la spec (`CON-28`: un patrimonio es cifra
  "protagonista pero ya resuelta" → `hero` 40 sans, no la cifra en construcción del keypad)
- `Amount` suma una prop `fit`: mide el contenedor con `ResizeObserver` y encoge
  `font-size`/`line-height` (nunca `transform`, para no perder nitidez) hasta un piso del 55%
  cuando el número no entra. Aplicada al patrimonio del home y de `/accounts`, y al resto de
  las cifras héroe de detalle (cuenta, deuda, meta, recurrente, transacción, split)

## [0.8.3] — 2026-08-02

Cierre de los pendientes accionables de la auditoría de acceso (`docs/auditoria-acceso.md`):
AC-5, AC-6 y AC-16 corregidos; AC-14 queda con diseño cerrado en
`docs/plan-sync-incremental.md` para una sesión dedicada. AC-12 (preferencias de UI
sincronizadas) sigue diferido a propósito.

### Corregido — la base legacy ya no se muestra a otra cuenta (AC-5)

- La salvaguarda de migración de `DbOwnerSync` mantenía la base anónima `perze` activa con
  CUALQUIER household no-demo: una segunda cuenta en el mismo navegador (cambio de sesión sin
  `signOut`) veía los datos de la primera. Ahora solo aplica si TODOS los households legacy son
  de la sesión actual (`createdBy === userId`); si no, la sesión abre su propia base y lo
  legacy queda intacto en `perze` para su dueño — no se muestra ni se borra

### Corregido — redirect muerto del shell y A1 (welcome) huérfana (AC-6)

- El redirect de `(app)/layout.tsx` sobre `household === null` era código muerto desde AC-18
  (el gate retiene el render hasta resolver sesión y base) — y escondía un bug: la decisión
  welcome-vs-A2 vivía ahí, así que **ningún camino llevaba al splash de bienvenida**. Se
  eliminó el efecto y la decisión ahora la toma `/onboarding` al montar sin sesión
  (`hasSeenWelcome()`), el único lugar al que proxy y gate realmente mandan

### Corregido — recuperación automática del SW con caché vieja (AC-16)

- Un deploy nuevo con PWA instalada podía dejar pestañas clavadas (o en loop de recarga): el
  precache viejo servía HTML que referencia chunks que ya no existen. `ServiceWorkerRegister`
  ahora detecta el fallo de carga de chunks, purga CacheStorage, fuerza la actualización del
  service worker y recarga UNA vez por ventana de 5 minutos — el guard en sessionStorage evita
  recrear el loop que corrige

### Documentado — plan de sincronización incremental (AC-14)

- `docs/plan-sync-incremental.md`: pull incremental por `updated_at` solo para `transactions`,
  refresh completo de las tablas chicas, watermark con solape en `meta`, merge que nunca pisa
  filas con entradas pendientes en el outbox, realtime como fase opcional. Listo para
  implementarse en una sesión dedicada

## [0.8.2] — 2026-08-02

### Corregido — flash de `/onboarding` en cada reload con sesión viva (AC-18)

- **Causa raíz**: en un reload, `useCurrentHousehold` resolvía contra la base Dexie **anónima**
  antes de que `DbOwnerSync` cambiara a `perze-<uid>` — el `null` falso se leía como "sin
  household" y la app mostraba la pantalla de alta un instante antes de volver
- `DbOwnerSync` publica ahora `settled` (`stores/db-owner-store.ts`) recién cuando la base
  activa es la correcta **y** el refetch de la invalidación terminó (se espera
  `invalidateQueries()` — si no, el gate leería el `null` viejo por otra puerta)
- Mientras se valida sesión/base, `OnboardingGate` muestra una pantalla de carga con el `ZMark`
  animado en las rutas no exentas — nunca el flash del onboarding ni un blanco sin explicación

## [0.8.1] — 2026-08-02

Probando v0.8.0 en producción, la restauración devolvió "nada que restaurar" — y la base remota
resultó estar **completamente vacía** pese a varios onboardings completados. La hidratación
funcionaba; lo que nunca funcionó, desde ningún navegador, fue la **subida**. Diagnóstico
verificado sentencia por sentencia contra el proyecto remoto (adenda de
`docs/auditoria-acceso.md`).

### Corregido — nada sincronizó jamás: el upsert moría con RLS en el primer insert (AC-17)

- **Causa raíz**: `syncOne` usaba `upsert` para todo. `upsert` genera
  `INSERT ... ON CONFLICT`, y bajo RLS esa forma exige poder ver/actualizar la fila en
  conflicto — para un household recién creado la membresía todavía no existe
  (`current_households()` vacío hasta que sincronice el member), así que el primer insert moría
  con 42501, pasaba a dead-letter tras 8 reintentos, y arrastraba a toda la cola: member,
  cuentas, categorías y movimientos dependen de ese household. Verificado: `INSERT` plano pasa;
  `ON CONFLICT DO NOTHING` y `DO UPDATE` fallan sin membresía; `DO UPDATE` pasa con membresía
- op `insert` ahora usa `INSERT` plano, con `23505` (duplicate key) tratado como "ya
  sincronizada por un intento anterior interrumpido" — la idempotencia que el upsert daba, sin
  su problema de RLS. op `update` conserva el `upsert`: a esa altura la fila y la membresía ya
  existen en el servidor

### Corregido — el loop de sync moría en silencio para toda la sesión (AC-17b)

- En `use-sync-loop.ts`, `outbox.count()` corría fuera de todo catch: un rechazo suyo (típico:
  `DatabaseClosedError`, porque `DbOwnerSync` cierra/borra la base Dexie justo en el login)
  tumbaba la promesa del tick **antes** de re-armar el timer — nada volvía a drenar hasta
  recargar la página. Ahora el timer se re-arma en un `finally`, siempre

### Agregado — "Reintentar todas" en el diagnóstico de sincronización

- Después del fix, lo normal en un dispositivo con datos viejos es una cola entera en `dead` —
  `outbox.retryAllDead()` + botón en Más → Sincronización las devuelve a la cola de un tap, en
  vez de resucitarlas de a una

## [0.8.0] — 2026-08-02

Auditoría completa del flujo de acceso (`docs/auditoria-acceso.md`, hallazgos `AC-1`…`AC-16`)
y su corrección central: **hidratación desde el servidor**. La sincronización era exclusivamente
push (outbox → Supabase); no existía ningún camino que bajara datos a un dispositivo nuevo, así
que toda sesión sin Dexie poblado moría en el onboarding — duplicando el household o, desde
v0.7.1, en un freno sin salida. Un usuario existente ahora entra desde cualquier dispositivo y
recupera sus cuentas, categorías, movimientos, presupuestos y configuración del household.

### Agregado — `hydrateFromRemote()` y `/onboarding/restore` (AC-1)

- `src/lib/offline/hydrate.ts`: baja las once tablas sincronizadas (households, members,
  accounts, categories, tags, payees, transactions, budgets, goals, recurring_rules, rules) al
  Dexie local. Contracara de `sync-config.ts`, con las mismas reglas de dinero: todo
  `bigint`/`numeric` viaja como `::text` (PostgREST pierde precisión arriba de 2^53 en
  silencio), rates por `parseRate`, `NULL` de FX preservado como `needs_fx` legítimo, y
  `current_balance` tomado del servidor tal cual (recomputar localmente con datos parciales por
  `can_see` daría un saldo falso). Todo paginado y dentro de `withoutOutbox()`
- `/onboarding/restore` reemplaza al freno `/onboarding/existing-household` de v0.7.1: en vez de
  avisar que los datos no están, los trae y entra a la app
- `/login` y `/reset-password` resuelven destino con `resolveOnboardingDestination()` en vez de
  ir a `/` a secas — dispositivo con datos → app; dispositivo nuevo → restauración

### Corregido — el invitado nunca llegaba al household que aceptó (AC-2)

- `/join` solo escribía `meta.currentHouseholdId`: sin ninguna fila local, el gate lo rebotaba
  al onboarding y podía crear un household duplicado. Ahora hidrata (scoped) el household de la
  invitación — sin tocar el resto de la base local

### Corregido — el household activo nunca salía del dispositivo (AC-3)

- `profiles.default_household_id` existía en el schema y nada lo escribía ni leía. Se publica al
  cerrar A11 y la hidratación lo usa para elegir qué household activar en un dispositivo nuevo

### Corregido — flujo y descubribilidad

- **AC-4**: `DbOwnerSync` cambiaba de base Dexie sin invalidar React Query — con
  `staleTime: Infinity`, un household cacheado contra la base anónima seguía sirviéndose después
  del cambio a `perze-<uid>`
- **AC-7**: A2 no tenía "Ya tengo cuenta" — el único camino al login (y a "olvidé mi
  contraseña") era el toggle de contraseña, poco descubrible
- **AC-8**: el login con contraseña desde A2 (y la detección de sesión existente) no seteaban la
  cookie `perze_registered`
- **AC-9**: `resolveOnboardingDestination()` sin manejo de error — sin red, la promesa rechazaba
  dentro del efecto y el usuario quedaba en A2 sin feedback. Nunca degrada hacia A4 (el camino
  que duplica): avisa y deja reintentar
- **AC-11**: el PIN local bloqueaba `/login`, `/forgot-password`, `/reset-password` y
  `/pending` — pantallas sin datos que pueden pertenecer a otra cuenta que la del PIN
- **AC-15**: `hasRemoteHousehold()` contaba households soft-deleted (la policy de SELECT ya no
  filtra `deleted_at` a propósito) — un household borrado disparaba la restauración para siempre

### Documentado — pendientes con dueño (`docs/auditoria-acceso.md`)

- **AC-5** salvaguarda legacy pegajosa de `DbOwnerSync` · **AC-6** doble redirect
  `OnboardingGate`/`(app)/layout` · **AC-12** preferencias de UI solo locales
  (`profiles.settings` sin uso) · **AC-14** la hidratación es de una sola vez, no continua (el
  multi-dispositivo simultáneo sigue siendo trabajo futuro) · **AC-16** loop de recarga del
  service worker tras un deploy

## [0.7.1] — 2026-08-02

Un fix sobre v0.7.0, encontrado probando el reset de contraseña real: el gate del shell
mandaba de vuelta a `/login` a cualquier sesión válida sin household local, en vez de dejarla
seguir el onboarding — loop infinito de login. De paso, evita que completar el onboarding en un
dispositivo nuevo cree un household duplicado cuando el usuario ya tiene uno.

### Corregido — loop infinito entre `/login` y `/` después de un reset de contraseña exitoso

- **Causa raíz**: `OnboardingGate` trata como "bloqueado" tanto la falta de sesión como una
  sesión válida sin household local (dispositivo/navegador donde nunca se completó el
  onboarding). El redirect a `/login` que decide la cookie `perze_registered` (v0.7.0) solo
  tiene sentido en el primer caso — con sesión viva, volver a loguearse nunca crea el household
  local, así que el gate seguía bloqueado después de cada login exitoso y volvía a mandar a
  `/login`
- Ahora solo la ausencia real de sesión (`userId === null`) consulta la cookie; con sesión viva
  y sin household local, sigue siempre a `/onboarding`, que ya detecta la sesión existente y
  salta directo a A4

### Agregado — guarda contra el household duplicado en un dispositivo nuevo

- Si el onboarding va a crear un household nuevo pero el usuario ya es miembro de uno en el
  servidor (típico de un navegador distinto al que usó para registrarse), se frena antes de A4:
  `resolveOnboardingDestination()` usa `households_select` (RLS, ya filtra por membresía) para
  detectarlo, y `/onboarding/existing-household` explica que este dispositivo no tiene los datos
  sincronizados todavía. No hay pull-sync completo (BASE-05, sigue diferido) — esta pantalla es
  el freno, no una solución

## [0.7.0] — 2026-08-02

Arregla la causa raíz de que el link de verificación no iniciara sesión, y agrega una vía de
acceso con contraseña — registro, login y recuperación — mientras no haya Google Auth ni Resend
con plantilla propia. Es una solución de transición documentada como tal
(`docs/mejora-auth-oauth-y-email.md` § 0.1): el diseño real de A2/A3/A4 sigue siendo sin
contraseñas, y este flujo se revierte en un solo movimiento cuando esas dos piezas estén.

### Corregido — el link del mail volvía a pedir el email, ahora sin señal de qué pasó

- **Causa raíz**: `signInWithOtp` no pasaba `emailRedirectTo`, así que GoTrue armaba el link con
  el `site_url` pelado. Un token PKCE ahí vuelve como `?code=...` a la raíz del sitio — en el
  query string, no en el fragment — y `src/proxy.ts` lo descartaba (`url.search = ""`) antes de
  que nadie lo canjeara. El código se perdía sin que la app pudiera saber si el mail se había
  validado o no
- `signInWithOtp` ahora pasa `emailRedirectTo` apuntando a `/auth/callback`, que ya sabía canjear
  `code`/`token_hash` pero nunca era el destino real del link
- `src/proxy.ts` reenvía a `/auth/callback` conservando el query completo apenas detecta
  `code`/`token_hash`/`error_code`, cualquiera sea el pathname — red de seguridad para los links
  ya enviados con el `redirect_to` viejo
- `additional_redirect_urls` en Supabase Auth pasa a comodín (`/**`): un link con querystring no
  matcheaba la URL exacta que exigía la config anterior

### Agregado — registro con contraseña, login y recuperación (transición)

- `/onboarding/register` — nombre y contraseña (con confirmación y ver/ocultar), destino real del
  link ya canjeado. País y moneda siguen siendo A4 (`/onboarding/country`), sin duplicar nada
- `/login` — email y contraseña para quien ya se registró; `/forgot-password` → `/reset-password`
  para recuperarla (`resetPasswordForEmail`, mismo canje de `/auth/callback` que ya sabía manejar
  `recovery`)
- Cookie `perze_registered` (`lib/auth/registered-cookie.ts`): sin sesión viva, decide entre
  `/login` (ya hubo una cuenta en este dispositivo) y `/onboarding` (primera vez) —
  `src/proxy.ts` y `OnboardingGate` la consultan por igual
- El código de 6 dígitos de A3 no se borró: queda detrás de `NEXT_PUBLIC_AUTH_OTP_CODE` (apagado
  por default), listo para reactivarse con una plantilla de mail propia
- `Input` (design system) suma `readOnly`, `disabled` y `revealable` — el toggle ver/ocultar
  contraseña que hasta ahora no existía en ningún campo, ni en `more/security`
- Errores de `signInWithPassword`/`setOwnPassword`/`requestPasswordReset` pasan a códigos
  tipados + `translateAuthError()`, traducidos en ES/EN/PT (antes hardcodeados en español)

### Corregido — de paso

- Loop infinito `/pending` ↔ `/onboarding`: `OnboardingGate` no eximía `/pending`, así que un
  usuario sin aprobar y sin household local rebotaba entre las dos pantallas sin parar
- `profiles.country` nunca se escribía pese a estar documentado como completado en A4 — la
  métrica `byCountry` del panel de operador leía siempre "desconocido". Ahora se escribe al
  confirmar el país en `/onboarding/country`

## [0.6.1] — 2026-08-01

Tres fixes sobre el acceso controlado de v0.6.0, encontrados probando el registro real del
operador: el link del mail de verificación no iniciaba sesión (devolvía a la pantalla del
email), el bootstrap de operador no cubría cuentas creadas después de la migración, y los
datos de ejemplo del demo sobrevivían al registro.

### Corregido — el link del mail de verificación devolvía a pedir el email

- **Causa raíz**: la plantilla propia del mail (`eea7061`) nunca llegó al proyecto remoto —
  `supabase config push` quedó pendiente y el plan free la rechaza — así que el mail real es el
  default de Supabase: un botón de link sin código. Ese link usa el flujo implícito de GoTrue y
  deja los tokens en el fragment de la URL (`#access_token=...`), que el proxy no puede ver (el
  fragment no viaja al servidor) y el cliente PKCE de `@supabase/ssr` no consume solo. El
  usuario aterrizaba en A2 con una sesión válida colgando de la URL y la pantalla le volvía a
  pedir el email
- A2 ahora consume esos tokens (`lib/auth/hash-tokens.ts` + `setSession()`) y redirige según el
  estado real: `/pending` sin aprobación del operador, la app si ya hay household local, o A4
  para seguir el registro. También saltea A2 cuando ya hay sesión, y un link vencido o inválido
  muestra el aviso proponiendo pedir un código nuevo (`onboarding.auth.linkError`, ES/EN/PT)
- `/auth/callback` acepta además links `?token_hash=...&type=email` verificados server-side
  (`verifyOtp`), y la plantilla `supabase/templates/magic_link.html` ahora trae las dos vías:
  el código de 6 dígitos para tipear y un botón "O continuá con un click" que apunta ahí —
  nunca a `{{ .ConfirmationURL }}`, que es el que termina en el flujo implícito

### Corregido — el bootstrap de operador no cubría cuentas nuevas

- El bootstrap de `20260801180000` corría una sola vez contra los perfiles ya existentes: si la
  cuenta del operador se creaba (o recreaba) después de la migración, nacía `pending` y la
  instancia quedaba sin nadie que pudiera aprobar — el operador bloqueado por su propio gate.
  Migración `20260801190000_operator_bootstrap_on_signup.sql`: `handle_new_user()` otorga
  operador + aprobación directamente en el alta cuando el email es el del operador (el trigger
  `profiles_protect_access` es `BEFORE UPDATE`, así que el `INSERT` no lo pelea), y re-corre el
  bootstrap original de forma idempotente

### Corregido — los datos de ejemplo del demo sobrevivían al registro

- **Causa raíz**: la salvaguarda de migración de `DbOwnerSync` (B4) leía el household demo de la
  base Dexie anónima como "datos legacy reales" y nunca cambiaba a la base namespaced del
  usuario — quien exploraba el demo y después se registraba quedaba mirando los datos de
  ejemplo para siempre
- `DbOwnerSync` ahora distingue el household demo (`createdBy === DEMO_USER_ID`): al aparecer
  una sesión real borra la base anónima entera y la cookie `perze-demo`, y recién ahí abre la
  base del usuario. La salvaguarda para datos legacy reales queda intacta
- A2 también mata la cookie demo en el momento del registro (`clearDemoCookie()`), para que la
  señal muera aunque el wipe de Dexie corra después

## [0.6.0] — 2026-08-01

Acceso controlado: contraseña como alternativa al OTP, desbloqueo por biometría además del PIN,
y un rol de operador de instancia con aprobación manual de altas nuevas y métricas simples — para
que una instancia personal, publicada como open source, no quede abierta a cualquiera con un
email válido. Incluye también el fix de un bug reportado en vivo: "Probar con datos de ejemplo"
dejó de entrar a la app después del blindaje de sesión de la versión anterior.

### Corregido — el modo demo no entraba a la app

- **Causa raíz**: `a21e02c` (v0.5.0) sumó tres gates de sesión de Supabase (`proxy.ts`,
  `OnboardingGate`, `useCurrentUserId()`) que no existían cuando se escribió el atajo de demo —
  `seedDemoHousehold()` nunca crea sesión real a propósito, así que los tres lo rebotaban a
  `/onboarding` apenas terminaba de sembrar. El "load" rapidísimo reportado era exactamente eso
- Nuevo modo demo local explícito (`lib/demo/demo-mode.ts`, cookie `perze-demo`) en vez de
  `signInAnonymously()` — crear una sesión real habría disparado `handle_new_user()` y, con el
  gate de aprobación nuevo de esta misma versión, el usuario demo hubiera nacido `pending` y
  quedado bloqueado igual
- **B15 cerrada** — el seed encolaba ~55 mutaciones al outbox con `created_by = DEMO_USER_ID`,
  un uuid que ninguna policy de RLS reconoce: se quedaban colgadas para siempre. Nuevo
  `outbox.withoutOutbox()` las suprime en el origen
- `handleDemo` ahora atrapa errores (antes un fallo del seed se veía igual que el bug: spinner y
  nada); "Salir del demo" nuevo en Más, que borra la base local y vuelve a `/onboarding`

### Agregado — operador de instancia: aprobación de acceso y métricas

- Migración `20260801180000_access_control.sql`: `profiles.is_app_admin`/`access_status`
  (`pending`/`approved`/`rejected`), trigger `protect_access_columns` (nadie se auto-aprueba ni
  se auto-asciende con un `UPDATE` directo — verificado con pgTAP, `22_access_control.sql`,
  9/9), y tres RPC `SECURITY DEFINER` (`admin_list_access_requests`, `admin_metrics`,
  `admin_set_access_status`) que rechazan a cualquiera que no sea `is_app_admin()`. Ninguna
  nombra `transactions`/`accounts`/`budgets` ni ninguna tabla financiera — el límite es
  estructural, no una convención. Bootstrap automático de la cuenta existente a operador +
  aprobada
- `proxy.ts` redirige a `/pending` (pantalla nueva) cualquier sesión sin aprobar antes de tocar
  el resto de la app; `/onboarding/verify` y `/onboarding/success` hacen el mismo chequeo del
  lado cliente, ya que `/onboarding/*` queda exento de sesión en el proxy
- Nueva pantalla "Panel del operador" (Más, solo visible con `is_app_admin`): cola de
  solicitudes pendientes con aprobar/rechazar, y métricas simples sin gráficos — totales,
  distribución por país, actividad por recencia (`last_seen_at`, actualizado desde el proxy como
  mucho una vez por día)
- Nota de privacidad (qué ve y qué nunca ve quien opera la instancia) en `/pending`, en el About
  y en la plantilla de mail — enmarcada como de primera parte, nunca como analytics de terceros
  (`docs/00-producto.md` § "cero analytics de terceros por defecto")

### Agregado — contraseña como alternativa al OTP

- Toggle en la pantalla de login ("Prefiero usar mi contraseña" / "Prefiero el código por
  email") — el código sigue siendo el default, la contraseña es opcional y se define desde
  Ajustes → Seguridad (`updateUser({ password })`)
- Errores de Supabase mapeados a copy que propone la corrección en vez de nombrarla
  (`features/auth/password-auth.ts`)
- `Input` (design system) gana `type`/`autoComplete` opcionales para poder enmascarar
  contraseñas — antes no existía forma de pedirle un campo `password` sin salir del componente

### Agregado — desbloqueo biométrico

- WebAuthn puramente local (`lib/security/webauthn.ts`) — re-entrada al mismo dispositivo ya
  logueado, mismo modelo de confianza que el PIN, nunca un passkey remoto de Supabase
- Toggle en Ajustes → Seguridad, visible solo si el dispositivo tiene sensor Y el PIN ya está
  configurado (el PIN sigue siendo el fallback obligatorio); `LockScreen`/`PinGate` traen la
  conexión a `onBiometric` desde hace tiempo sin usar — queda wireada, con intento automático y
  silencioso al mostrarse el gate

### Sin tocar en esta pasada (declarado, no silencioso)

- Recuperación de contraseña por email: `resetPasswordForEmail` depende de la misma plantilla
  bloqueada por el plan free de Supabase que `magic_link`, y `auth/callback/route.ts` hoy solo
  procesa el callback de OAuth. Conectar el flujo entero es trabajo aparte, no una casilla de
  esta pasada

### Técnico

- `supabase db push --linked` aplicado y verificado en vivo contra el proyecto real; pgTAP
  nuevo (9/9), `database.types.ts` regenerado
- `pnpm vitest run` (374/374, +8 nuevos), `tsc --noEmit`, `eslint` (limpio salvo los problemas
  preexistentes en `docs/design/*`/`docs/library/*`, ajenos a esta pasada), `next build`

---

## [0.5.0] — 2026-08-01

Resolución completa de `docs/plan-resolucion-auditoria-tecnica.md` (126 hallazgos de cinco
auditorías paralelas) en las diez fases que el propio documento proponía, F0 a F9, cada una en
su rama y su commit, mergeadas a `main` en orden. Corrección de datos, identidad y sesión,
superficie de API, schema/RLS reproducible y sync confiable quedan completos; accesibilidad,
bundle y deuda menor quedan parciales y declarados abajo. Suma además dos fixes de post-mortem
sobre el flujo de login real: el mail de verificación llegaba con link a `localhost` en vez de
código, y pegar el código de a uno por casilla no era descubrible.

### Corregido — F0, higiene inmediata

- `.dockerignore` (faltaba del todo): `.env*` horneaba en cualquier `docker build`
- `@tanstack/react-virtual`/`sharp` movidos de `devDependencies` a `dependencies`
  (`package.json`) — un build de producción con `--prod` los perdía

### Corregido — F1, corrupción de datos en FX/captura/outbox

- `sync-config.ts`: `fx_rate`/`original_rate`/`counter_fx_rate` viajaban al outbox con
  `bigintToString` en vez de `formatRate()` — un rate escalado ×10¹² podía llegar a Supabase sin
  desescalar
- **A3** — sin cotización de captura, el número tipeado se reinterpretaba como si ya estuviera
  en la moneda de la cuenta. Corregido para preservarlo en `original_*` con `original_rate:
  NULL`; migración `20260801090000` relaja el `CHECK original_triple` y agrega
  `needs_capture_fx` (columna generada) — decisión tomada con el usuario ante el conflicto con
  el constraint existente
- **A4** — nuevo `resolve-pending-fx.ts`: única escritura legítima de `amount_base` después de
  la inserción, cuando un movimiento `pending` se resuelve; antes vivía duplicado inline en
  `accounts/resolve-fx/page.tsx`
- **C3** — `sync-worker.ts` no reseteaba una entrada `syncing` interrumpida (pestaña cerrada a
  mitad de drenaje) — quedaba huérfana para siempre. `outbox.recoverInterrupted()` la recupera
  al reiniciar
- **C4** — 11 repos (`accounts`/`categories`/`tags`/`payees`/`budgets`/`goals`/
  `recurring-rules`/`households`/`categorization-rules`/`conflicts`/`transactions`) encolaban al
  outbox FUERA de la transacción de Dexie de la escritura — un crash entre medio perdía la
  entrada de sync sin dejar rastro. Todos reescritos para encolar en la misma transacción
- **D10** — `todayIso()` (nuevo, `lib/dates/today.ts`, vía `Intl.DateTimeFormat`) reemplaza 5
  ocurrencias crudas de `new Date().toISOString().slice(0,10)` más un duplicado en
  `api/fx/route.ts` — todas en UTC puro, rompían la fecha "de hoy" pasadas las 21h en UY/AR

### Corregido — F2, identidad y sesión

- `proxy.ts` no usaba el resultado real de `getUser()` — cualquier ruta fuera de una allowlist
  corta quedaba accesible sin sesión
- `useCurrentUserId()` pasa a tri-estado (`string | null | undefined`) — ~20 sitios de escritura
  ya no asumen un uid que puede no existir todavía
- No existía `signOut()` real: nuevo `lib/auth/sign-out.ts` (Supabase + `db.delete()` + limpieza
  de stores persistidos + purga de `CacheStorage` + `unsubscribeFromPush()`), Dexie
  namespaced por usuario (`perze-${userId}`, `db-owner-sync.tsx`)
- **B9/B14** — `PinGate` vivía solo en `(app)/layout.tsx`: `/search`,
  `/transactions/[id]/edit`, `/accounts/new`, `/accounts/[id]/edit` filtraban datos sin pedir
  PIN. Movido a `providers.tsx` con allowlist pre-auth explícita; excepción real de edición sin
  desbloquear durante 60 s (`capture-recency-store.ts`)
- **C22** — `AccountPickerSheet` mostraba saldos con la app bloqueada (long-press evadía el PIN
  desde el shortcut de captura); ahora los oculta pre-desbloqueo
- **B8** — `failedAttempts`/`lockedUntil` del PIN vivían solo en memoria — recargar la página
  anulaba el lockout de 3 intentos. Persistidos en `pin-store.ts`
- **B12** — hash del PIN pasa de SHA-256 sin sal a PBKDF2-SHA256 con sal por dispositivo,
  migración transparente del hash viejo

### Corregido — F3, superficie de servidor

- `/api/fx`: sin auth (401 ahora obligatorio), sin Zod, interpolación cruda en un `.or()`, sin
  `Cache-Control: no-store` — cualquiera podía leer/envenenar cotizaciones ajenas
- `supabase/functions/send-push`: sin resolver el usuario desde `Authorization`, sin chequeo de
  membresía del household (403 ahora), body sin validar, errores no opacos, sin limpieza de
  suscripciones muertas (410/404)
- **E4** — códigos de invitación con `Math.random()` (recuperable) → `crypto.getRandomValues`;
  nueva migración valida email contra `auth.users`, `expires_at DEFAULT now() + 7 días`,
  `CHECK (role <> 'owner')`
- `otp_expiry`/`minimum_password_length`/composición de contraseña endurecidos en
  `supabase/config.toml`; `safe-next-path.ts` (nuevo) valida `next` contra open redirect en
  `auth/callback`

### Corregido — F4, schema reproducible y RLS real

- **A5/A13** — ~25 policies con `WITH CHECK` tautológico (`household_id = (SELECT
  tabla.household_id)`, siempre `TRUE` porque RLS no tiene `OLD`) en 12 archivos: un miembro de
  dos households podía mover cualquier fila propia entre ellos. Reemplazado por un trigger
  `BEFORE UPDATE` genérico de inmutabilidad real + trigger de protección de rol (solo un owner
  cambia roles a/desde `owner`, nunca degrada al último)
- **A11/A12** — cero `GRANT`/`REVOKE` en 30 migraciones: nueva migración con `GRANT` explícito
  (sin `DELETE`, coherente con soft-delete) y `REVOKE EXECUTE … FROM PUBLIC, anon` en toda
  función `SECURITY DEFINER`
- **A6** — `transaction_splits`/`transaction_shares` sin `fx_source`: cuando el padre resolvía
  su `pending`, los hijos quedaban `NULL` para siempre. Columnas + `CHECK` pareado + trigger
  `AFTER UPDATE ON transactions` que propaga la resolución hacia abajo
- **A2** — diagnóstico contra el remoto: `budgets`/`goals`/`recurring_rules` ya tenían el shape
  v2 (`040000`), no el viejo de `010900`/`011000`. Reconciliado con una migración nueva en vez
  de reescribir migraciones ya pusheadas
- pgTAP: 8 archivos actualizados (el trigger de inmutabilidad cambia el mensaje de error, no la
  protección real), nuevo `20_fx_propagation.sql`; `scripts/db-reset.sh` nuevo

### Corregido — F5, sync confiable y visible

- **A7** — `inherited` podía tomar una cotización posterior a la fecha del movimiento
  (`resolve.ts` no filtraba `asOf <= date`) — un import retroactivo heredaba el rate de hoy
- **A8** — el override manual ignoraba `householdId`/vigencia; ahora filtrado por household y
  fecha (límite conocido y documentado: dos households escribiendo el mismo par el mismo día
  todavía pueden pisarse en el `put()`, corregirlo del todo pide mover `householdId` a la clave
  primaria)
- **C10/C11/A10/C12** — `clientRev` estaba hardcodeado a `1` en 9 tablas fuera de
  `transactions`: el versionado optimista era ficticio. Ahora real e incremental, con
  `conflictSensitive` extendido a esas tablas; conflictos se detectan, se guardan y se muestran
  (badge en Más, banner critical en home, ícono en `TransactionRow`) en vez de resolverse en
  silencio "el último que sincroniza gana"
- **C8/C9/C32** — el outbox se drenaba en orden de `status`, no de llegada; sin backoff ni
  techo de reintentos (un error permanente reintentaba cada 30 s para siempre). FIFO real por
  PK, backoff exponencial con jitter, dead-letter a partir de 8 intentos, pantalla de
  diagnóstico en Más con reintento manual
- **C7** — `SyncDot` inferìa "offline" de `pending > 0`: tener cola y no tener red son cosas
  distintas. `useOnlineStatus()` nuevo, con listeners reales
- **B6/B7** — `completeOnboarding()` sin transacción (un fallo a mitad de camino dejaba un
  household activo sin cuenta) y `/onboarding/success` con un guard de `useRef` que no
  sobrevive a un remount real (duplicaba el household). Transacción única + idempotencia real
  vía `getCurrentHouseholdId()` + estado de error con reintento
- **B10** — reenvío de OTP sin cooldown; ahora 60 s con contador visible
- **C24** — borrado/restauración masiva de movimientos en `Promise.all` — dos seleccionados de
  la misma cuenta podían pisarse el delta de saldo. Pasa a secuencial
- **C5/C6 (alcance acotado)** — `createOptimisticMutation()` sin un solo caller en toda la app.
  Se adoptó `invalidateAfterTransactionWrite()` en los 8 sitios reales que escriben
  transacciones; la adopción completa en cada mutación de la app queda pendiente, es un cambio
  de arquitectura

### Corregido — F6, motores que faltaban

- **E20** — `fx_rates` vacía para siempre (nada la escribía). Nueva Edge Function
  `daily-fx-sync` (desplegada, probada contra el proyecto real — 26 cotizaciones cargadas) +
  cron diario
- **E9a** — ninguna `recurring_rule` se materializaba sola.
  `materialize_recurring_transactions()` la crea en su `day_of_month`, idempotente por período,
  con la misma cadena de resolución de FX que el resto de la app
- **E9b/E9d** — `send-push` documentaba textualmente que nadie la llamaba.
  `dispatch_due_notifications()` dispara `budget_alerts`/`recurring_reminders`/`weekly_summary`
  con de-dup vía `audit_log`; `insights` (detección de anomalías) queda declarado como feature
  nueva, no hay motor de detección del lado servidor que reusar
- **E9c/E9e/E9f** — `card_statements` nunca pasaba a `overdue`, `audit_log`/
  `push_subscriptions` crecían sin límite. Tres funciones + cron: transición por vencimiento,
  purga por retención (nunca borra `delete`/`role_change`), tope de 5 + caducidad a 270 días

### Corregido — F7, accesibilidad e i18n

- **D3** — `Sheet` no tenía portal, trampa de foco, Escape ni scroll lock (28 archivos la usan);
  ahora reusa `Overlay` internamente (`variant="sheet"`)
- **D2** — `TransactionRow` era siempre `<div>`: un movimiento clickeable no entraba en el orden
  de tabulación. Mismo patrón que `ListRow` (`Tag = onClick ? "button" : "div"`)
- **D1** — `<html lang>` se corregía solo en un `useEffect` post-hidratación — un lector de
  pantalla podía alcanzar a anunciar con la voz equivocada antes de que corriera. Script
  síncrono pre-paint (mismo patrón que el anti-flash de tema)
- **D4-D7** — cuatro tokens de contraste bajo AA: `--text-muted` (2,95–3,92:1), `--aqua-light`/
  `--orange-light` en claro (única polaridad que fallaba), `--critical` en oscuro (3,58:1).
  Corregidos con tests reales de fórmula WCAG, no solo de presencia de string. `--warning` sale
  del texto de `Banner`/`NeedsFxBanner` (1,76:1 en claro) — queda solo en ícono/tinte de fondo
- **D8/D9** — `Input` sin `aria-describedby`/`aria-invalid`/`role="alert"`; `OtpInput` con seis
  casillas mudas sin contexto. Corregidos con asociación real y "dígito N de M" por casilla
- **D11** — cero `<h1>` en toda `(app)` — `AppHeader` renderizaba el título en un `<div>`
- **D13/D14** — la tecla decimal del `Keypad` estaba hardcodeada a "," — en un locale `en-US`
  corrompía el monto 10x si el "." se leía como separador de miles. Corregido en los 9 call
  sites reales (captura, edición, cuentas, metas, deudas, presupuestos, recurrentes,
  onboarding, conciliación), con `aria-label` traducido en `KeypadKey`
- **D15** — nuevo `<IconButton>` (44×44 real); 13 de 17 botones solo-ícono migrados
- **D12 (parcial)** — `role="img"` + resumen calculado en los 8 charts SVG; el toggle "ver como
  tabla" página por página no se cableó

### Corregido — F8, fluidez y bundle (parcial)

- **C14** — `Toaster` global importaba el barrel completo de `@phosphor-icons/react`
  (+9.000 íconos) en vez del subpath `dist/ssr`
- **C16/C15** — los 6 módulos opcionales repetían `useEffect(router.replace) + if-en-render`
  después de que sus hooks de datos ya habían disparado sus queries. Nuevo `<ModuleGate>`
  declarativo + cada página dividida en `page.tsx` delgado y un `XxxPageContent` cargado con
  `next/dynamic`: si el módulo está apagado, ni el código ni las queries corren
- **C15** — `BarChart`/`LineChart`/`Donut`/`Sankey` diferidos con `next/dynamic` en las 5
  páginas de Análisis/cuentas que los usan — antes cero usos de `next/dynamic` en toda la app
- **C18** — `skipWaiting: true` activaba el service worker nuevo a mitad de sesión (causa
  clásica de "chunk load error" post-deploy). Ahora queda esperando hasta que
  `ServiceWorkerRegister` ofrece un toast de actualización

### Corregido — F9, deuda menor (parcial)

- **A18** — 77 columnas de foreign key sin índice cubriente en `public` (barrido completo
  contra `information_schema`, no solo las puntuales que nombraba la auditoría)

### Corregido — Login por email: código real, no un link a localhost

- El mail de `signInWithOtp` mandaba la plantilla "magic_link" default de Supabase — un botón
  de link, nunca el código de 6 dígitos que `/onboarding/verify` pide tipear a mano — y ese link
  apuntaba a `site_url`, que en `supabase/config.toml` seguía en `http://127.0.0.1:3000` (el
  default de desarrollo local, nunca actualizado). `site_url` pasa al dominio real; plantilla
  propia (`supabase/templates/magic_link.html`) muestra `{{ .Token }}` grande, sin ningún link
  — el flujo real de la app nunca consume ese link (`auth/callback` solo atiende OAuth)
- **Bug de fondo encontrado en el mismo diagnóstico**: el proyecto generaba códigos de **8**
  caracteres con vigencia de **1 hora**, mientras la pantalla de verificación solo tiene 6
  casillas — la verificación probablemente venía fallando por eso, no solo por el link.
  Corregido a 6 dígitos / 10 minutos
- **Bloqueado**: la plantilla de mail no se pudo pushear al proyecto real — Supabase rechaza la
  edición de plantillas en el plan free con su proveedor de mail default. Necesita SMTP propio
  (sección `[auth.email.smtp]` ya preparada en `config.toml`) o upgrade de plan
- `OtpInput`: nuevo botón "Pegar código" (`navigator.clipboard.readText()`) — pegar en una
  casilla de un solo dígito ya funcionaba pero no era descubrible

### Sin tocar en esta pasada (declarado, no silencioso)

- F8: manifest estático, `share_target` POST, `queryKeys` centralizados, `<VirtualList>`
  extraído, Dexie `versionchange`/`blocked`, demo aislado y purgable, Zod en el onboarding,
  `headers()`/CSP (los scripts inline de tema/lang necesitan nonce), cascada de soft-delete +
  regla ESLint de `deleted_at`, rates de usuario por string crudo
- F9: A17 (no es un bug real), A19 (re-sincronizar `01-arquitectura-datos.md` con el schema
  real), A20, B19-B21, D28/D29, E17/E18. E19 (notificación persistente de captura) se reporta
  como feature nueva, no como fix
- D16-D30, B17, B22 (prioridad media/baja) y la revisión de copy en portugués (D23) — marcada
  para hablante nativo, no para este fix

### Técnico

- 10 ramas (`fix/f0-higiene-inmediata` … `fix/f9-deuda-menor`), 10 commits, mergeadas a `main`
  en orden con conflictos reales resueltos a mano en F5 (`clientRev` real + encolado
  transaccional, complementarios, no excluyentes), F7 (`numberLocale` + `existing` combinados
  en `update-transaction.ts`) y F8 (páginas de módulo ya divididas)
- `database.types.ts` regenerado contra el remoto ya reconciliado en vez de resolverlo a mano
- Verificación end-to-end contra el proyecto real (`perze-app`) en cada fase:
  `supabase db push --linked`, pgTAP re-corrido (12 suites, sin fallas después del merge —
  las que venían fallando por F4/A2 dejan de fallar apenas esas fases quedan mergeadas),
  `tsc --noEmit`, `pnpm vitest run` (363/363), `eslint` (68 problemas — sin cambios, todos en
  archivos vendored/generados ajenos a esta pasada), `next build`

---

## [0.4.1] — 2026-08-01

El hueco central de la pantalla de acceso (A2) deja de estar vacío: la grilla 3×3 de la marca
lo ocupa con una animación de barrido — un bloque violeta que recorre la Z — y la misma
variante pasa a ser el loader del flujo de onboarding.

### Agregado

- Variante `sweep` en `ZMark`: un solo bloque encendido en `--primary-ink` recorre la Z
  (400 ms por celda, ciclo de 2,8 s, keyframe `zsweep` en la hoja base). El default sigue
  siendo `pulse`, así que los usos existentes no cambian
- Colocación: centro de A2 (`/onboarding`, tamaño 32), loader de A11 mientras se crea el
  household (reemplaza el `Skeleton`) y loader de A3 mientras se verifica el código OTP
  (antes no había indicador visible)

### Cambiado

- `ZMark` con `Movimiento: reducida` ya no anima celda por celda: el conjunto pulsa entero
  con `zpulse`, sin stagger ni violeta (`02-design-system.md` § 5.4); con `mínima` sigue
  quedando estática
- `aria-label` de `ZMark` es ahora una prop (default `"PERZE"`) y las pantallas pasan
  `t("app.name")` — cierra la deuda D29 del plan de auditoría técnica
- Ficha de `ZMark` en `contrato-componentes.md` actualizada con `variant`, tiempos y
  comportamiento por intensidad

## [0.4.0] — 2026-08-01

Conecta la app al backend real por primera vez — Supabase deja de ser un plan en
`01-arquitectura-datos.md` y pasa a ser un proyecto linkeado (`perze-app`) con 32 tablas, RLS
probado con pgTAP, y programa 84 de las 119 pantallas del plan de diseño. Suma también el
resultado de una auditoría completa de escritorio (sidebar, layout de dos columnas, buscador
flotante) y de la selección de categoría en la captura. Detalle completo del estado ítem por
ítem en `docs/plan-de-trabajo.md` (122/124 ítems).

### Agregado

#### Schema y RLS — 29 migraciones contra un proyecto Supabase real

- 12 migraciones base (`supabase/migrations/20260801010000` a `20260801011100`) escriben de
  cero el schema de `01-arquitectura-datos.md`: `extensions`, `reference`
  (`currencies`/`countries`/`fx_rates`), `identity` (`profiles`/`households`/
  `household_members`/`household_invites`/`household_fx_preferences` +
  `current_households()`/`can_write()`), `visibility` (`visibility_grants` + `can_see()`),
  `catalog` (`institutions`/`asset_classes`/`instruments`, Patrón C con clonado),
  `accounts` (+ `account_balance_snapshots`), `classification`
  (`categories`/`tags`/`payees`), `transactions` (+ `transaction_tags`/`splits`/`shares`,
  triggers `inherit_fx_state_*`, recompute de `current_balance`), `fx_overrides`,
  `budgets_goals`, `recurring_debts`, `investments` (`portfolios`/`trades`/
  `price_snapshots`/`target_allocations`/`portfolio_snapshots`) y `system`
  (`settlements`/`rules`/`insights`/`audit_log`/`import_batches`)
- El orden de creación se reescribió respecto al de `05-prompts-desarrollo.md`, que era
  irresoluble tal cual estaba: `current_households()`/`can_see()` se usan en policies de
  `accounts`/`categories` pero dependían de tablas creadas después, y `accounts.institution_id`
  referenciaba una tabla que el orden viejo creaba en la migración siguiente
- Toda policy de `UPDATE`/`ALL` de esta sesión usa `household_id = (SELECT tabla.household_id)`
  (o el FK al padre equivalente en las hijas) en vez del patrón de `01-arquitectura-datos.md` §3
  (`household_id IN (SELECT current_households())`), que no impide que un usuario miembro de
  dos households mueva una fila propia de uno a otro
- Migraciones adicionales de features que no tenían tabla: `budgets_goals_recurring`
  (`household_invites`), `mirror_mode` (`mirror_accounts`/`mirror_transactions` para J4b, con
  `can_see_as()` parametrizado por `viewer_id`), `seed_asset_classes`, `card_statements_
  price_index_benchmarks_notifications` (`card_statements`, `price_index`, `benchmarks`/
  `benchmark_series`, `notification_preferences` + push subscriptions), `auth_new_user_trigger`,
  `household_insert_policies`, `seed_reference_data`
- **Decisión de simplificación deliberada**: `budgets`/`goals` no tienen tablas de estado
  derivado — el gastado de un presupuesto se calcula on-the-fly desde `transactions` en vez de
  persistir en `budget_periods`, y el progreso de una meta es el saldo de una cuenta vinculada
  (`goals.account_id`) en vez de una tabla `goal_contributions`. Menos estado que reconciliar,
  mismo resultado visible
- Proyecto real enlazado: `perze-app` (ref `dhnyihwcsexraivhokoc`, org `torto-dev`,
  `us-east-2`), migraciones aplicadas con `supabase db push --linked`
- `pnpm db:types` / `pnpm db:push` agregados a `package.json`, y `@supabase/ssr` +
  `@supabase/supabase-js` como dependencias nuevas

#### GATE-1 (RLS) cerrado — 86/86 aserciones pgTAP en verde

- `supabase/tests/database/` — 10 archivos (`10_accounts_rls` a `19_identity_rls`) cubren
  las ~32 tablas del esquema con el patrón: household A no puede leer/escribir/actualizar/
  **mover** una fila de household B, y las 4 fallan
- Sin `supabase test db` disponible en esta máquina (necesita Docker), los tests corren con
  `supabase db query --linked -f <archivo>` contra la Management API. Como esa vía no soporta
  `\gset` de psql ni devuelve más que el último statement, el fixture (`00_setup.sql`) pasa
  valores entre pasos con `set_config`/`current_setting` bajo `tests.*`
  (`tests.stash()`/`tests.get()`) y acumula el reporte TAP en una tabla `tests.tap_log` que se
  imprime entera antes del `ROLLBACK` final

### Corregido

#### Tres bugs de RLS encontrados corriendo GATE-1, ninguno detectable con un test que solo prueba "A no ve la fila de B"

- **Soft-delete roto por RLS en 18 tablas**: `UPDATE ... SET deleted_at = now()` — el único
  mecanismo de borrado de todo el esquema — fallaba porque Postgres exige que la fila
  *resultante* de un UPDATE también satisfaga la policy de SELECT, no solo el `WITH CHECK`.
  Sin este fix nadie podría haber borrado nada nunca. Corregido sacando `deleted_at IS NULL`
  de 18 policies de SELECT (`20260801020000`/`020100`/`020200`).
  **Consecuencia para todo código nuevo**: RLS ya no filtra soft-deletes — cualquier query que
  no los quiera ver tiene que agregar `.eq('deleted_at', null)` explícitamente
- `household_id`/FK-al-padre no era realmente inmutable en `tags`, `payees`, `institutions`,
  `asset_classes`, `instruments` — permitía mover una fila propia a otro household del mismo
  usuario. Corregido en `20260801020300_fix_tags_payees_immutability.sql`
- Recursión infinita en la policy de `household_members_update` (consultaba la propia tabla
  sin pasar por una función `SECURITY DEFINER`). Nuevo helper `is_household_admin()` en
  `20260801020400_fix_household_members_recursion.sql`
- `household_members_insert` solo dejaba auto-insertarse — invitar a otra persona necesitaba
  su propia función `SECURITY DEFINER`. Se creó por error una tabla `invites` nueva sin
  comprobar que ya existía `household_invites` (mismo error que "un documento, una copia" pero
  en schema); corregido tirando la duplicada y reescribiendo `accept_invite(invite_code)`
  contra la tabla real (`20260801050100_fix_duplicate_invites_table.sql`)
- `mirror_accounts`/`mirror_transactions` (J4b) devolvían `SETOF` completo, dejando que
  PostgREST serialice `bigint` como `number` de JS — reescrita con `RETURNS TABLE` explícito y
  `::text` en cada bigint (`20260801060100_fix_mirror_bigint_precision.sql`), mismo patrón que
  `/api/fx`
- Semilla de `asset_classes` con nombres en español ("Cripto") en vez de los que
  `01-arquitectura-datos.md` prescribe ("Crypto") — `lib/money/decimals.ts` busca por nombre
  exacto para asignar 8 decimales, y con "Cripto" el lookup fallaba en silencio. Corregido en
  `20260801070100_fix_asset_classes_seed.sql`

#### `lib/fx` conectado de verdad a Supabase

- `/api/fx` ya no usa un override hardcodeado en `null` ni cachea solo en memoria de proceso
  (se perdía en cada cold start) — ahora lee `fx_overrides`/`fx_rates` reales. Verificado
  end-to-end contra `perze-app`: trajo una cotización real de dolarapi.com
- **Bug de precisión encontrado**: `numeric(24,12)` vuelve de PostgREST como JSON `number` si
  no se pide `::text` explícito — le vuela precisión a un rate igual que a un monto. El route
  ahora pide `rate::text` y parsea con `parseRate()`, nunca confía en el `number` del tipo
  generado
- `fxRepo.resolve()` pasa `householdId` a `/api/fx` para que el lookup de `fx_overrides` no
  quede sin uso
- Falta a propósito, para una pasada futura: cron diario de cotizaciones y la excepción de
  `inherited` → histórico real al reconectar

#### Modelo de dos conversiones de FX implementado en la captura

- `TransactionRow`/`SettlementRow`/`TransactionShareRow`/`TransactionSplitRow`
  (`src/lib/db/schema.ts`) ganan `originalAmount`/`originalCurrencyCode`/`originalRate`
  (transacciones) y `fxRate`/`fxSource`/`amountBase` (settlements)
- **Bug real encontrado y corregido**: `save-transaction.ts`/`update-transaction.ts` usaban la
  moneda capturada como `currencyCode` de la transacción en vez de la de la cuenta — violaba
  la regla de las dos conversiones. Ahora la primera conversión (capturada → cuenta) resuelve
  por `fxRepo` y llena `original_*`; `amount`/`currencyCode` quedan siempre en moneda de cuenta

#### Sincronización offline real, no solo infraestructura sin usar

- **Encontrado**: `createOptimisticMutation()` y el outbox (`lib/offline/outbox.ts`) ya
  existían, pero nada los llamaba — los repos de accounts/categories/tags/payees/transactions
  escribían directo a Dexie sin encolar nada
- `lib/offline/sync-config.ts` (nuevo): mapea camelCase → snake_case por tabla, `bigint`
  siempre como `string`, nunca `number`, ni siquiera para un rate
- `lib/offline/sync-worker.ts` (`drainOutbox`, nuevo): traduce cada entrada del outbox a un
  `upsert`/`update`/`delete` real contra Supabase, con "falla una fila, siguen las demás"
- `lib/offline/use-sync-loop.ts` (nuevo): dispara el drenaje al montar, al volver la conexión,
  y cada 30s
- `households`/`household_members` sumadas a `SYNC_TABLES`; verificado de punta a punta contra
  `perze-app` que un household creado localmente sincroniza de verdad
- Sin hacer a propósito: Realtime (pull de cambios de otros miembros) y el registro de
  Background Sync en el service worker — necesitan dos sesiones autenticadas simuladas, quedan
  para la próxima pasada

#### Conflictos de edición concurrente ya no se resuelven en silencio

- **Hallazgo de la auditoría final**: `client_rev` se guardaba y se mandaba a Supabase pero
  nada lo comparaba nunca — dos ediciones offline del mismo movimiento se resolvían "el último
  que sincroniza gana", exactamente lo que la app promete que no pasa
- `TransactionRow.syncState`/`syncError` (Dexie `version(5)`), `conflictSensitive` en
  `sync-config.ts` (solo `transactions`, la única tabla con edición multi-miembro real hoy),
  `detectRevisionConflict()` en `sync-worker.ts`, tabla local `conflicts` para no perder
  ninguna versión, `conflicts-repo.ts` + `(app)/more/conflicts/page.tsx` para resolver
  (quedarse con la versión local o la del servidor)

#### `lib/money` y `lib/fx` extendidos

- `formatNumber(value: number, decimals: number)` en `lib/money/format.ts` — no existía en
  absoluto; sin default en `decimals`
- `decimalsForQuantity()` en `lib/money/decimals.ts` — crypto por símbolo, FCI/Crypto por
  asset class, default 0 para acciones/CEDEARs/bonos
- `interpolateAmount()` (nuevo, con test) en `CountUp.tsx`: `animate()` de Motion ahora anima
  un ratio 0→1, no un monto — el monto en sí nunca pasa por `Number()` durante la animación,
  ni siquiera para interpolar. Test cubre un monto de 10^19 unidades, muy por encima de
  `Number.MAX_SAFE_INTEGER`
- Sparkline/delta del hero de Home (`(app)/page.tsx`) reescrito para no pasar por
  `Number()`/`Math.round()`/`BigInt()` — grep de `Number(` sobre variables de plata en el
  archivo da cero. Falta un test unitario dedicado con montos que excedan
  `Number.MAX_SAFE_INTEGER`
- `interest_rate`/`coupon_rate numeric(8,4)` e `instruments.ratio numeric(12,6)` documentados
  como excepción explícita en `catalog.sql` — no son montos ni tipos de cambio, no había que
  "corregirlos" a la escala estándar
- `transaction_splits`/`transaction_shares` con `deleted_at` y policies separadas
  SELECT/INSERT/UPDATE sin `DELETE` (reemplaza un `FOR ALL` que exponía DELETE, violando la
  regla de que DELETE nunca se expone)

### Agregado — Biblioteca de componentes (GATE-3 cerrado, 29/29 piezas `[spec]`)

- **18 componentes genuinamente nuevos**: `PriceStatus`, `PositionRow`, `NeedsFxBanner`
  (solo conteo, nunca `amount` — un movimiento sin rate no tiene `amount_base`, sumar montos
  de monedas distintas da un número falso), `MonthCalendar`, `CalendarHeatmap` (con
  `--ramp-1..7`), `Donut`, `Waterfall` (con invariante de dev-time de que los deltas suman el
  total), `Sankey`, `RankingBar`, `BenchmarkBars`, `StoryFrame`, `InfoCard`, `DragRow` (handle
  44px), `ComparisonBars`, `MirrorBanner`, `SectionGroup` (unifica `AccountRow`/`RateRow`/
  `GroupCard`/`ResultGroup`/`ResolutionChain`), íconos nuevos (`mail`, `lock`, `fingerprint`,
  `install`, `globe`, `bank-checking`), `StackedBar`/`DivergingBar`
- `EmptyState` reemplaza el ícono de línea por `ZMark` (nuevo) al 20%/28% — el fix #1 de la
  auditoría visual, afecta a los 68 estados vacíos ya diseñados
- Token de superficie de selección + anillo (`--selection-surface`/`--selection-ring` en
  `globals.css`, documentado en `02-design-system.md` §2.2): la vieja selección por superficie
  daba 1,065:1 de contraste en claro (indistinguible); el nuevo da 1,24:1/1,52:1 en claro y
  1,24:1/1,45:1 en oscuro, verificado por fórmula WCAG. Migrado a `SegmentedControl`,
  `CategoryBubble`, `DateStrip`, `AccountCarousel`, `OptionCard`, `InstitutionTile`. `Chip` se
  dejó a propósito con `--primary-fill` (filtro activo, permitido por el presupuesto de ruido)
- `InstitutionTile`: logos de institución reemplazados por baldosa de monograma (dos letras
  sobre `institutions.color`) — sin binarios de terceros en el repo, funciona offline;
  `institutions.logo_url` queda como slot opcional para logos reales en carpeta local
  ignorada por git
- Cero banderas en toda la app: `CurrencyChip` sin emoji (tenía el comentario literal "el
  único lugar del sistema donde aparece emoji"); `onboarding/country`, formulario de cuenta,
  lista y detalle de cuenta muestran el nombre del país, no la bandera —
  incluido un tercer sitio no anticipado en el plan (lista/detalle de cuentas mostraban la
  bandera *sola*, sin nombre). `countryFlag()`/`CountryRef.flag` eliminados
- `StatusBadge`: el escalamiento por edad (`neutral` + `ageDays >= 7` → `warning`) se movió
  adentro del componente — antes lo decidía cada caller
- `Skeleton`/`Sheet`: props de tamaño string-o-number normalizadas adentro del componente
  (`<Skeleton height="20" />` ya no colapsa a 0px)
- `SplitBar`: paleta de datos (`--data-1..5`) reemplazada por un token de "partes" propio, no
  ligado a la paleta de gráficos; thumb visible y arrastrable con hit-area de 44px;
  `showThumb`/`showValues`/`tolerance` nuevos
- `KeypadKey` extraído y compartido entre `Keypad`/`PinKeypad` (antes cada uno duplicaba su
  propio botón); ambos anuncian por `aria-live` (`Keypad` el monto, `PinKeypad` "N de M
  dígitos" sin revelar el valor)
- `TabBar`: `badge?: number` por slot y 4to slot configurable por preferencia de usuario
  (default Análisis)
- `TransactionRow`: 4 estados nuevos (`pending`, `shared`, `attachment`, `installment`)
- `AccountCarousel`: `secondaryBalance?: ReactNode` para cuentas de broker en dos monedas
- `ErrorState`: segunda acción (`alternativeLabel`/`onAlternative`), camino alternativo
  primero
- `UndoToast`: variante `progress` (sin botón de acción, contador + barra)
- `OfflineBanner` renombrado a `Banner` con `status: 'offline' | 'warning' | 'error'` +
  `action?`
- `useQueryErrorState` (hook, nuevo): patrón reusable de estado de error sobre `ErrorState`,
  usado en Home, cuentas y movimientos como referencia para el resto de la app
- Regla de lint (`eslint-rules/no-excess-primary-fill.mjs`, nueva): cuenta usos de
  `--primary-fill` por archivo de pantalla, con excepciones declaradas (`Switch` encendido,
  identidad de `SegmentedControl`, `UndoToast`)
- Documentadas por escrito las 3 reglas que la auditoría pedía y no existían en ningún lado:
  cuándo se gana `hero-xl` 64 vs. `hero` 40; `critical` (estado) vs. naranja de polaridad
  (rendimiento negativo); cuándo se repite `$` en una lista

### Agregado — Autenticación y onboarding (Bloque A, 11 pantallas + L6)

- Auth real contra Supabase: `signInWithOtp`/`verifyOtp`, ya no simulado. Con OAuth sin
  configurar (`NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` vacío), el campo de email es primario y los
  botones de Google/Apple no se renderizan — ausentes, no deshabilitados
- `completeOnboarding()` corregido para recibir el `userId` real de la sesión en vez de un
  `DEMO_USER_ID` hardcodeado que nunca iba a poder sincronizar (`created_by` no coincidía con
  ningún `auth.uid()`). Mismo fix aplicado a los otros 4 sitios que usaban `DEMO_USER_ID`
  (`useCurrentUserId()`, nuevo hook) fuera de onboarding: conciliación, alta/edición de
  cuenta, `CaptureFlow`
- Verificado de punta a punta contra `perze-app` con un usuario de prueba real: login →
  trigger crea `profiles` → household → household_members (self, owner) → accounts →
  categories, los 5 pasos con RLS real y aislamiento cross-household confirmado
- `onboarding/welcome` (A1), `onboarding/usage` (A5, decide `enabled_modules` incluye
  `family`), `onboarding/account` (A6, monograma de institución), `onboarding/complete` (A7,
  A10 — saldo inicial e instalación de PWA pedidos después del primer gasto, nunca antes)
- `(app)/more/categories` (A8): plantilla "Completa" nueva (20 categorías con subcategorías de
  super/transporte/salud) en `category-templates.ts`; `applyCategoryTemplate()` nunca borra
  categorías con movimientos cargados, solo archiva las del sistema sin uso
- `(app)/more/modules` (A9): apagar un módulo con datos reales pide confirmación con el número
  real de recurrentes/cuotas/cuentas de inversión/otros miembros afectados, nunca inventado
- **L6 (pantalla de bloqueo, vive en `bloque-a-onboarding.html` no en el bloque L)**:
  `usePinStore` (hash SHA-256, nunca texto plano; 3 intentos errados → 30s de espera, nunca
  borra el PIN) + `PinGate` en `(app)/layout.tsx` (nunca en `/add` ni en la ventana de edición
  de 60s) + `(app)/more/security` para activar/definir el PIN. Apagado por defecto

### Agregado — Captura rápida (Bloque C)

- `save-transaction.ts` resuelve `original_*` vs. moneda de cuenta vía `fxRepo.resolve()` — las
  dos conversiones reales, no una
- Transferencia cross-currency (selector origen/destino + invertir) en `CaptureFlow`
- Guardado optimista con `MorphButton` (botón → check → vuelo) + `UndoToast` vía `sonner`,
  sobrevive al desmontaje del flow
- Burst mode: `resetForBurst()` + contador en el header del flow
- Captura por voz: `VoiceCaptureSheet.tsx` + parser rioplatense con test, con fallback
  explícito a "no soportado" — sin verificar en dispositivo real fuera de Chrome/Safari
- Foto de ticket: solo el entry point (botón + toast "todavía no disponible"), como pide el
  diseño para esta fase
- Error/offline al guardar: toast post-guardado distingue needs_fx vs. offline
  (`navigator.onLine`); `Banner status="offline"` con conteo real también en la lista de
  movimientos, antes solo en Home. **Corrección de este mismo plan**: C11 es "sin conexión al
  guardar" según `docs/design/INDEX.md`, no "auto-categorización por reglas" — esto último no
  está en ningún archivo de diseño, se había anotado por error

### Agregado — Movimientos (Bloque D)

- `(app)/transactions/calendar` (D5): heatmap por día de 90 días, click al detalle del día —
  reimplementa su propia grilla en vez de consumir `MonthCalendar` (deuda de DRY documentada,
  escrita después que esta pantalla)
- Selección múltiple por long-press en la lista de movimientos (D7)
- Filtros de movimientos (`MovementsFiltersSheet.tsx`, D2)

### Agregado — Cuentas (Bloque E)

- `(app)/accounts` (E1): reorden real de cuentas vía `DragRow`, persiste `sortOrder`
- `accounts/[id]/reconcile` (E5): los 3 pasos del diseño (pregunta → diferencia → ajuste)
  resueltos como una sola pantalla continua; crea el movimiento de ajuste con needs_fx si la
  cuenta no está en moneda base
- `(app)/currencies` (E6): lista de pares, editor de rate, override manual
  (`fxRepo.setManualOverride`). Falta E6.4 (histórico de rates a lo largo del tiempo)
- `accounts/resolve-fx` (E8, no estaba ni en código ni en los prompts originales): agrupa
  movimientos sin cotización por moneda origen, aplica el rate resuelto a todo el grupo y
  setea el override
- E4 (tarjeta de crédito) queda bloqueado de verdad: requiere `card_statements`, sin schema
  decidido hasta esta pasada (ahora existe la tabla pero la pantalla no se construyó)

### Agregado — Análisis (Bloque H, dos partes)

- `(app)/analytics` (H1): hero de patrimonio + tasa de ahorro/gasto diario,
  `NeedsFxBanner`, lista de qué se puede ver ya vs. qué falta (con mínimos reales de
  `lib/analytics/history.ts`/`period-summary.ts`)
- `analytics/categories` (H2, `Donut`): composición del último período cerrado, 5 slots +
  "Otros"
- `analytics/trends` (H3): implementado con `BarChart` (gasto diario 14 días + delta semana
  vs. semana) en vez de `StackedBar`/`DivergingBar` — simplificación de alcance declarada, el
  diseño no tenía series apiladas que mostrar acá
- `analytics/net-worth` (H5): `Sparkline` de tendencia de 30 días en vez de `Waterfall` — no
  hay snapshots de patrimonio que descomponer en deltas todavía
- `analytics/calendar` (H8, `CalendarHeatmap`): heatmap real de 90 días de gasto
- `analytics/merchants` (H9, `RankingBar`): ranking real por comercio del último período
  cerrado
- `analytics/flow` (H4, `Sankey`) + `lib/analytics/money-flow.ts`: tres columnas
  ingresos→cuentas→destinos, top 5 por lado + "otros", needs_fx excluido y declarado
- `analytics/currencies` (H6) + `lib/analytics/currency-exposure.ts`: exposición por moneda
  nativa y convertida a base, % de patrimonio, cuentas sin cotización excluidas y contadas.
  El "impacto del tipo de cambio" del diseño queda afuera (necesita snapshots históricos)
- `analytics/insights` (H10) + `lib/analytics/insights.ts`: racha de días registrando + fecha
  estimada de sobregiro si el ritmo de gasto actual se mantiene
- `analytics/weekly` (H11) + `lib/analytics/weekly-summary.ts`: total de la semana, día más
  caro, comercio más visitado, categoría con mayor cambio vs. la semana anterior, needs_fx
  excluido y contado
- `analytics/wrapped` (H12, Wrapped) + `lib/analytics/wrapped.ts`: seis frames con datos
  reales (patrimonio, movimientos, comercio top, tasa de ahorro, días activos). Gate real: 12
  meses cerrados, no los 6 que decía la anotación original del diseño ("gastos hormiga" no se
  programó, necesita heurística de categorización que no existe — se reemplazó por días
  activos, un dato real)
- `analytics/export` (H13): CSV de movimientos de un período con cuentas/saldos opcionales;
  needs_fx se exporta igual, columna de conversión vacía a propósito
- H7 (gasto en USD constantes) queda bloqueado de verdad: requiere `price_index`, cuya tabla
  se agregó recién en esta pasada pero sin la vista construida encima

### Agregado — Presupuestos, metas, recurrentes, deudas (Bloques F+G)

- `(app)/budgets`: lista con `BudgetRing`, progreso real del período en curso,
  `NeedsFxBanner` con conteo real de excluidos (`computeBudgetProgress`, con tests) en lista y
  detalle
- `hooks/use-budget-alerts.ts` (`identifyBudgetAlerts`): insight en Home + badge en la tab de
  presupuestos al cruzar 80%/100%. Sin disparador de push automático — repetir el aviso sin
  volverse ruidoso es una decisión de producto que no se tomó sola
- `(app)/goals`: progreso = saldo de la cuenta vinculada, no una tabla de aportes
  (simplificación de schema documentada arriba)
- `(app)/recurring`: plantilla real vinculada a `transactions.recurring_id`, declara si ya se
  cargó el mes en curso. Falta la vista de calendario (G1) y editar/archivar una regla ya
  creada (G3)
- `(app)/debts`: vista de solo lectura sobre cuentas `loan`/`receivable`/`credit_card` con
  saldo pendiente, `NeedsFxBanner` para cuotas sin cotización. G5/G6/G6a (detalle con
  cronograma, plan de cuotas) quedan bloqueados de verdad: requieren `debts.origin_transaction_id`/
  `installment_count` con una decisión de schema propia, más profunda que la de budgets/goals

### Agregado — Grupo familiar (Bloque J)

- `(app)/family`: lista de miembros + invitaciones pendientes; `family/invite` (generar
  código de 8 caracteres) + `/join` (aceptar, ruta hermana) — sin envío de email real (falta
  Edge Function + proveedor), sin QR todavía
- `family/permissions` (J4): private/household/custom por cuenta y categoría, selector de
  miembros para "custom" contra `visibility_grants` real
- `family/mirror/[memberId]` (J4b, modo espejo): `mirror_accounts`/`mirror_transactions`
  (`SECURITY DEFINER`, `can_see_as()` parametrizado por `viewer_id`, nunca amplía el acceso de
  quien mira)
- `transactions/[id]/split` (J5/J6): `split-shares.ts` con reparto igual y por porcentaje,
  exactos al centavo, el resto nunca se pierde. Solo "partes iguales" tiene UI — porcentaje/
  monto exacto necesitan un input por miembro no construido todavía
- `family/settle` (J7, **el needs_fx más grave**: un gasto compartido en USD sin cotización
  cambia quién le debe a quién): `computeNetBalances()` (con 6 tests) excluye shares sin
  `share_amount_base` del neto y declara el conteo excluido, nunca los cuenta como si valieran
  cero
- `family/compare` (J8, `ComparisonBars`): comparación real por categoría del último período
  cerrado, apoyada en `visibility_grants` — sin el opt-in mutuo explícito del diseño
- `family/activity` (J9): auditoría de altas/bajas de `visibility_grants`, quién se lo dio o
  sacó a quién
- Sacar a un miembro (J10) chequea `computeNetBalances`: si el neto de ese miembro no es cero,
  bloquea y manda primero a `/family/settle`
- `accept_invite(invite_code)` (`SECURITY DEFINER`, quien acepta todavía no es miembro) —
  ver corrección de schema arriba

### Agregado — Inversiones (Bloque I)

- **Decisión de arquitectura deliberada**: este módulo no pasa por Dexie/outbox — lee y
  escribe directo contra Supabase, mismo patrón que invitaciones y splits familiares. Cargar
  una operación de inversión no tiene el objetivo de 5 segundos de un gasto
- `(app)/investments` (I1/I2, `Donut`): activación del módulo, creación del primer
  portfolio, composición por clase de activo
- `PositionRow` (I3, objetivo duro: 8 posiciones heterogéneas legibles en 390px) +
  `computePositions()` (5 tests: acumula compras, prorratea costo base en venta parcial,
  cierra una posición vendida del todo), needs_fx
- `investments/[portfolioId]/trades/new` (I4-I6): un solo formulario cubre compra y venta,
  comisiones y fecha no se separaron a un paso propio
- `investments/[portfolioId]/instruments/new` (I7b): crear instrumento a mano cuando el
  picker no lo encuentra — símbolo, nombre, clase de activo, moneda, siempre clonado al
  household, nunca escribe una fila global
- `investments/allocation` (I9): `SplitBar` sin paleta de datos de marca
- I8 (reordenar posiciones con `DragRow`) no se construye: las posiciones son un agregado
  calculado de `trades`, no una lista con orden propio. I10 (`BenchmarkBars`) e I11 (XIRR)
  quedan bloqueados de verdad: requieren `benchmarks`/`benchmark_series` e
  `instrument_cashflows`, tablas que no se inventaron sin decisión de schema

### Agregado — Ajustes (Bloque K)

- `(app)/more/profile` (K2) — `household_members.display_name` no se sincroniza todavía: no
  hay policy que deje escribir su propia fila a un `member` común
- `(app)/more/settings` (K3): 4to slot del tab bar, día de cierre del período por household
  (solo owner/admin), moneda base. K3c (color de marca por household) diferido — no hay
  mecanismo de theming
- `(app)/more/tags` (K6): crear/renombrar/borrar tags y comercios
- `(app)/more/export` (K10) + `lib/export/export-household.ts`: backup JSON completo de lo
  local-first, con conteo real por tabla; no incluye lo que vive solo en Supabase (invites,
  shares, settlements, inversiones), declarado en pantalla
- `(app)/more/notifications` (K12): preferencias por tipo + suscripción push real (VAPID,
  `lib/push/subscribe.ts`), `push`/`notificationclick` en el service worker.
  `supabase/functions/send-push` escrita y **desplegada** con secrets VAPID configurados —
  sin disparador automático (cron/trigger) a propósito, encender un envío recurrente es una
  decisión de producto que no se tomó sola
- `(app)/more/about` (K13): licencia MIT mostrada directo
- K7 (reglas de auto-categorización), K9 (importador CSV de 3 pasos) diferidos: necesitan un
  motor de reglas contra transacciones nuevas y un wizard de mapping/duplicados propio,
  respectivamente — ninguno es una pantalla de ajustes suelta

### Agregado — PWA y marca

- `share_target` en el manifest (faltaba del todo): `action: /add`, `method: GET`, mapea
  `title`/`text`/`url` a la nota del borrador sin pisar lo que el usuario ya escribió
- Verificado en runtime (`next build && next start` + `curl`): `/serwist/sw.js` con 148
  entradas de precache (~5.2 MB), `/manifest.webmanifest` y `/offline` responden 200
- 5 íconos de `public/icons/` (`any`/`maskable`/`monochrome`, archivos distintos donde
  corresponde — declarar el mismo PNG en `any` y `maskable` hace que Android recorte el
  ícono), ícono de shortcut de "agregar gasto", 28 splash screens de iOS (`scripts/
  generate-splash-screens.mjs`, 14 dispositivos × esquema claro/oscuro) referenciados en
  `layout.tsx` — commiteados en `public/` en vez de generados en build, discrepancia menor
  con el criterio original, no bloquea nada

### Agregado — Preparación open source

- `LICENSE` (MIT) + `"license": "MIT"` en `package.json`
- `README.md` reescrito de cero — el anterior describía el paquete de diseño, no la app
  construida
- `docs/self-hosting.md`, `CONTRIBUTING.md`, `.env.example` con todas las env vars reales que
  usa el código (incluida `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, sumada a `src/env.ts`)
- `Dockerfile` + `docker-compose.yml` — sin `output: standalone` a propósito, porque
  `@serwist/turbopack` compila el service worker en runtime leyendo `src/app/sw.ts` de disco
  y necesita el árbol completo. No probado contra un build real (sin Docker en esta máquina)
- `lib/seed/demo-household.ts` revisado: sin datos personales, solo nombres de comercios
  reales uruguayos para realismo

### Agregado — Escritorio: sidebar completo y buscador flotante

- Un solo breakpoint de navegación (1024px, `DESKTOP_BREAKPOINT`/`SPLIT_BREAKPOINT` en
  `use-is-desktop.ts`) — antes el `Sidebar`/`TabBar` conmutaban en `md` (768px) mientras
  `useIsDesktop()` conmutaba en 1024px, dejando una banda 768-1023px donde se veía el chrome
  de escritorio pero `/transactions`/`/accounts` seguían abriendo el detalle como modal
- Shell fijo al viewport (`.app-shell`/`.app-shell-column`/`.app-shell-main` en `globals.css`,
  `height: 100dvh` + cadena de `min-height: 0`) — `<main>` pasa a ser el único contenedor de
  scroll de la app, en todos los anchos. Corrige que el sidebar se fuera con la página (no
  tenía `height`/`overflow` propios) y el doble scroll del virtualizador de `/transactions`
- `Sidebar` (`buildDesktopNav()`, nuevo, en `lib/nav/desktop-nav.ts`) pasa de mostrar los 4
  tabs del móvil a toda la navegación agrupada (Dinero/Personas/Sistema, misma taxonomía que
  `/more`), con match de activo por prefijo más largo (`activeNavId()`, con tests)
- `/transactions` y `/accounts` en escritorio: nuevo ancho de contenido por ruta
  (`content-width.ts`, `--content-max-width-wide` 1200px) — el layout de dos columnas vivía
  adentro de los 560px de ancho global, dejando ~76px para la lista. El split ahora arranca en
  1280px (`SPLIT_BREAKPOINT`), no 1024: a 1024 el sidebar + un panel de detalle legible no
  dejan lugar para una lista usable
- `/accounts` en escritorio (≥1024px) pasa a grilla de tarjetas; reorden por menú (subir/
  bajar) en vez de arrastre, que sigue siendo el único mecanismo en la lista móvil (`DragRow`
  asume índices 1-D, una grilla es 2-D)
- Buscador flotante (`Overlay.tsx`, primitiva nueva de diálogo con portal y foco atrapado;
  `search-overlay.tsx`; `lib/search/rank.ts` con normalización de acentos, con tests) —
  reemplaza la navegación a `/search` y el ⌘K de `command-palette.tsx` (borrado, unificado
  acá). Resultados de categoría/comercio llevan a `/transactions` ya filtrado
  (`?category=`/`?payee=`) en vez de a una lista sin filtrar

### Agregado — Categorías más usadas reales en la captura

- `lib/analytics/category-usage.ts` (nuevo, con tests): ranking por uso real —
  `countCategoryUsage()`/`rankCategoriesByUsage()`, ventana de 90 días con fallback a
  histórico completo si no hay suficiente actividad reciente para llenar el límite
- `use-frequent-categories.ts` deja de ser un stub que devolvía las primeras N por
  `sortOrder` — ahora usa el ranking real sobre las transacciones del household
- `CategoryStep.tsx` rediseñado: grilla de 6 burbujas (5 más usadas + "Otro", mismo patrón de
  burbuja sintética que `budgets/new` usa para "todo el hogar"). "Otro" abre un sheet con
  buscador, lista completa y «Crear "{nombre}"» — primera entrada de UI a
  `categoriesRepo.create()`, que hasta ahora tenía cero llamadores (`create-category.ts`,
  con tests, para los defaults y el chequeo de duplicado por nombre)
- Los chips rápidos de `AmountStep` pasan de 4 a 5 (con la misma fuente de ranking que
  `CategoryStep`) y de una fila con scroll horizontal a `flexWrap: wrap` — en escritorio
  desbordaban el ancho disponible sin scroll ni wrap visible

### Corregido — `/transactions/calendar` y `/accounts/resolve-fx` rotos por una intercepción de ruta

- `transactionsRepo.get()`/`accountsRepo.get()` devolvían `undefined` cuando no encontraban
  la fila — TanStack Query v5 no lo permite en un `queryFn` y tiraba "Query data cannot be
  undefined" en cualquier navegación a un id inexistente. Ahora normalizan a `null`
- La causa real del crash reportado: `calendar`/`resolve-fx` son hermanas estáticas de `[id]`
  bajo el mismo directorio que interceptan `@detail/(.)[id]` en `/transactions` y `/accounts`
  — cualquier navegación blanda (`router.push`/`Link`) hacia ahí desde dentro de esas rutas
  hace que el interceptor trate el segmento como si fuera un id de movimiento/cuenta, sin
  importar que exista una página estática con ese nombre. Es un comportamiento estructural de
  Next con intercepting routes, no algo que una página sombra pueda anular en navegación de
  cliente — los dos botones que llevan ahí ahora fuerzan una recarga completa
  (`window.location.href`) en vez de navegación de cliente
- `e2e/offline-no-duplicates.spec.ts`: el regex del toast no contemplaba
  `capture.savedOffline` ("Guardado en el teléfono..."), el mensaje real que muestra
  `CaptureFlow.doSave()` al guardar sin conexión — el test nunca veía el toast y fallaba
  siempre en ese punto, antes de llegar a la parte que decía cubrir

### Técnico

- **i18n**: paridad de claves verificada entre `es.json`/`en.json`/`pt.json` — 889 claves en
  cada uno, 0 faltantes en cualquier dirección. `react/jsx-no-literals` en 0 sobre todo
  `src/**` fuera de `dev/`
- **Accesibilidad**: auditoría de botones solo-ícono sin `aria-label` — 1 caso real corregido,
  el resto de ~30 ya estaba correcto. Sin verificar: axe-core real, VoiceOver/TalkBack en
  dispositivo físico, zoom de texto al 200% (necesitan navegador real)
- **Performance**: confirmado que ningún módulo apagado llega al cliente — la app navega con
  `router.push()` imperativo en todos lados, sin `next/link`, así que Next nunca prefetchea
  una ruta de módulo apagado. Sin N+1 real en los `Promise.all(...map(...))` revisados
  (siempre sobre colecciones chicas y acotadas). Un `toFixed(2)` sobre plata encontrado y
  corregido en `more/import/page.tsx` (pasa a `formatAmountCompact`)
- **Auditoría de seguridad final**: sin `service_role` en el bundle del cliente, sin secretos
  en archivos versionados, RLS de las tablas nuevas revisado a mano (`USING`+`WITH CHECK`
  pareados). Rate limiting no verificado (necesita infraestructura de servidor fuera de este
  repo). 50 mutaciones offline simultáneas no probadas con dos clientes reales — cubierto en
  cambio por `sync-worker.test.ts` (8 casos: inserts/updates/deletes, aislamiento de errores,
  el conflicto real)
- `tsconfig.json`, `eslint.config.mjs` ajustados; suite de Vitest y build verificados en verde
  a lo largo de toda la pasada
- Escritorio/buscador/categorías más usadas verificados aparte: `tsc --noEmit`, `eslint` y
  314 tests de Vitest en verde; los flujos de escritorio (sidebar, split de dos columnas,
  buscador, "Otro"/crear categoría) probados a mano en navegador a 1024/1280/1440px

### Pendiente

- Backend: Realtime (pull de cambios de otros miembros), registro de Background Sync en el
  service worker, cron diario de cotizaciones, disparador automático de push (presupuestos/
  recurrentes)
- Pantallas bloqueadas de verdad por falta de schema/decisión propia: E4 (tarjeta de
  crédito), G1/G3 (calendario y edición de recurrentes), G5/G6/G6a (detalle y cronograma de
  deudas), H7 (gasto en USD constantes), I8/I10/I11 (reorden de posiciones, benchmarks, XIRR)
- K7 (reglas de auto-categorización) y K9 (importador CSV) diferidos — motor de reglas y
  wizard de mapping/duplicados propios, no encajan como pantalla de ajustes suelta
- Sin verificar en dispositivo real: instalación de la PWA, VoiceOver/TalkBack, zoom de texto
  al 200%, captura por voz fuera de Chrome/Safari de escritorio
- `Dockerfile`/`docker-compose.yml` sin probar contra un build real (sin Docker en esta
  máquina, y no lo va a haber — ver `CLAUDE.md`)
- Falta una revisión manual completa de la app antes de considerar esta pasada cerrada

---

## [0.3.0] — 2026-07-28

### Corregido

#### Botones de Google/Apple en el onboarding con logo real

- `design-system/core/Icon.tsx`: sumados `google` (`GoogleLogoIcon`) y `apple`
  (`AppleLogoIcon`) de Phosphor — antes ambos botones de OAuth en
  `onboarding/page.tsx` usaban el ícono genérico de `mail`, sin distinguir un
  proveedor del otro

### Agregado

#### Versión de la app visible en el front

- `src/lib/version.ts` — única fuente de verdad, lee `version` directo de `package.json`
  (nada hardcodeado en un segundo lugar que se pueda desincronizar en el próximo bump)
- Expuesta en la metadata de `src/app/layout.tsx` (`generator`, `other["app-version"]`)
- Visible para el usuario como footer en "Más" (`(app)/mas/page.tsx` → ahora
  `(app)/more/page.tsx`), formato `PERZE v{version}`, se actualiza sola en cada bump

### Cambiado

#### Rutas de navegación traducidas al inglés

Todos los segmentos de URL bajo `src/app/` pasan de español a inglés — cambia el path, no
las pantallas ni los textos de la interfaz (que siguen en `next-intl`, ES/EN/PT):

| Antes                                   | Ahora                      |
| --------------------------------------- | -------------------------- |
| `/agregar`, `(.)agregar` (interceptada) | `/add`, `(.)add`           |
| `/cuentas`                              | `/accounts`                |
| `/cuentas/nueva`                        | `/accounts/new`            |
| `/cuentas/[id]/editar`                  | `/accounts/[id]/edit`      |
| `/cuentas/[id]/conciliar`               | `/accounts/[id]/reconcile` |
| `/cuentas/resolver-fx`                  | `/accounts/resolve-fx`     |
| `/movimientos`                          | `/transactions`            |
| `/movimientos/[id]/editar`              | `/transactions/[id]/edit`  |
| `/movimientos/calendario`               | `/transactions/calendar`   |
| `/mas`                                  | `/more`                    |
| `/monedas`                              | `/currencies`              |
| `/analisis`                             | `/analytics`               |
| `/buscar`                               | `/search`                  |
| `/onboarding/pais`                      | `/onboarding/country`      |
| `/onboarding/uso`                       | `/onboarding/usage`        |
| `/onboarding/cuenta`                    | `/onboarding/account`      |
| `/onboarding/exito`                     | `/onboarding/success`      |
| `/onboarding/completar`                 | `/onboarding/complete`     |
| `/onboarding/verificar`                 | `/onboarding/verify`       |

- También traducidos, aunque las pantallas todavía no existen: `/inversiones` →
  `/investments`, `/presupuestos` → `/budgets` (`FOURTH_TAB_ROUTE` en `(app)/layout.tsx`)
- Actualizados todos los `router.push`/`router.back` de las pantallas afectadas, el shortcut
  de la PWA en `manifest.webmanifest`, y los cuatro tests E2E (`page.goto`/`waitForURL`)

### Técnico

- `package.json` `0.2.0` → `0.3.0`
- Build, lint, suite de Vitest (116 tests) y los 4 E2E de Playwright verificados en verde
  después del rename de rutas

---

## [0.2.0] — 2026-07-28

Rediseño completo de la app contra `perze-design/` — nueva base de código, nuevo modelo de
datos, nuevo sistema de diseño. El MVP anterior (`[0.1.0]`/`[0.1.1]`) queda archivado en
`src/app-old/` (ignorado por git, no se toca ni se migra) y este changelog documenta la app
que lo reemplaza: PERZE, PWA de finanzas personales multi-cuenta, multi-moneda y multi-país.
Plan completo en [`docs/perze-plan-redesign-first-5-blocks.md`](docs/perze-plan-redesign-first-5-blocks.md).

Cubre las Fases 0 a 9 del plan — fundaciones, y los Bloques C, B, D, E y A en ese orden de
construcción (C primero porque sus componentes los consume todo el resto; A último porque es
el único bloque que se podía saltear con un household de demo mientras se construía todo lo
demás) — más el trabajo posterior de responsive, auditoría PWA, migración de íconos y tests E2E.

### Infraestructura y stack (Fase 0-1)

- Next.js 16 (App Router, Turbopack como bundler por defecto), TypeScript estricto
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `verbatimModuleSyntax`), Tailwind CSS v4 con `@theme inline`
- **Dexie.js** (IndexedDB) como persistencia local-first, detrás de una capa de repositorios
  (`lib/repos/*`) pensada para enchufar Supabase más adelante sin rediseñar pantallas
- TanStack Query v5 para estado de servidor/Dexie; Zustand solo para estado de UI efímera
  (scope activo, borrador de captura, estado del keypad, intensidad de animación) — nunca
  datos de dominio
- `next-intl` con ES rioplatense como idioma fuente, EN y PT (`messages/{es,en,pt}.json`);
  cero strings hardcodeadas en toda la app
- Zod v4 como fuente de tipos de validación; Serwist para el service worker; ESLint (no Biome)
  como único linter/formateador
- Vitest + Testing Library para unitarios, Playwright para E2E
- `src/app/globals.css`: tokens portados de `perze-design/PERZE-Design-System/tokens/`; DS
  dark-first (`:root` es oscuro, `.light` invierte) con `@custom-variant dark` para no pelear
  contra la convención por defecto de Tailwind
- `src/lib/motion/springs.ts`: las 4 curvas y 4 duraciones exactas del design system

### Núcleo de dominio (Fase 2)

- `lib/money/` — `Money = { amount: bigint; currency: CurrencyCode }`. Cero `number`, cero
  `parseFloat`, cero `toFixed` sobre montos; parser de expresiones del keypad
  (`1200+350*2`), redondeo bancario explícito, formateo vía `Intl.NumberFormat`
- `lib/fx/` — `convert()` con resolución en orden estricto: override manual > cotización del
  día > último valor conocido (`isStale`) > `pending`. Nunca cae a rate = 1. `needs_fx`
  completo, con ascenso `neutral → warning` a los 7 días sin resolver
- `lib/db/` — schema completo de Dexie (households, accounts, transactions, categories,
  payees, tags, fx_rates, outbox, meta), versionado, con IDs UUID v7 generados en el cliente
  antes de la mutación (idempotencia)
- `lib/repos/` — una interfaz por agregado (`AccountsRepo`, `TransactionsRepo`, …); ninguna
  pantalla toca Dexie directo
- `lib/offline/outbox.ts` — cola de mutaciones + `createOptimisticMutation()`, lista para
  cuando exista un backend real que la drene
- `lib/seed/demo-household.ts` — household de demo (5 cuentas, incluida una en USD distinta a
  la moneda base, ~40 movimientos verosímiles en UYU/USD/ARS) accesible desde "Probar con
  datos de ejemplo" en el onboarding

### Sistema de diseño (Fase 3)

Portado desde `perze-design/PERZE-Design-System/` a `src/design-system/{core,money,finance,
nav,feedback,charts}/` con inline styles sobre CSS vars (fidelidad 1:1, sin traducir a clases
de Tailwind dentro del DS). Componentes: `Button`, `Card`, `Chip`, `Input`, `ListRow`,
`OtpInput`, `ProgressSteps`, `ResultGroup`, `SegmentedControl`, `Sheet`, `StatusBadge`,
`Switch`, `DismissibleNotice`; `Amount`, `AmountScrubber`, `CurrencyChip`, `FxEditor`,
`Keypad`, `PinKeypad`, `PrivacyBlur`; `AccountCarousel`, `AccountRow`, `BudgetRing`,
`CategoryBubble`, `DateStrip`, `GroupCard`, `InsightCard`, `InstitutionTile`, `OptionCard`,
`ProgressBar`, `RateRow`, `ResolutionChain`, `SplitBar`, `StatTile`, `TransactionRow`;
`EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton`/`SkeletonRow`, `UndoToast`;
`BarChart`, `LineChart`, `SeriesLegend`, `Sparkline`.

- Selección por **superficie** como default (segmentados, día activo, cuenta activa,
  categoría activa); el relleno violeta reservado para chip activo, tab activo y switch
  encendido — corregido en `SegmentedControl`, `CategoryBubble`, `DateStrip`,
  `AccountCarousel` y el slider de `FxEditor`, que originalmente gastaban el violeta sin ser
  la acción primaria de la pantalla
- `Amount` recibe `Money` (bigint + moneda), no `number` — único lugar de la app que formatea
  plata
- `aria-checked` agregado a `SegmentedControl` (accesibilidad real, no cosmética)
- `ScopeSwitcher` eliminado (quedó como alias trivial de `SegmentedControl`)
- Primitivas de motion en `components/motion/`: `Pressable` (scale 0.96 + haptic 8 ms),
  `CountUp` (odómetro 400 ms), `StaggerList`, `MorphButton` (botón → círculo → check),
  `useHaptics()`, `useMotionIntensity()` (completa/reducida/mínima + `prefers-reduced-motion`)
- Referencia viva en `/dev/components` (todos los estados de cada componente) y `/dev/tokens`

### Bloque C — Captura rápida (Fase 5)

- Ruta interceptada `/(app)/@modal/(.)agregar` con URL propia y back nativo; acceso directo
  por `/agregar` también funciona (shortcut de la PWA, share target)
- C1: monto con `Keypad` de pantalla completa + fila de categorías frecuentes **sobre** el
  keypad — el camino feliz baja a 2 taps (monto + categoría frecuente guarda directo, sin
  pasar por la grilla de categorías ni un botón "Guardar")
- C2: grid de burbujas de categoría como fallback, no camino principal
- C3: detalles en sheet (cuenta, fecha, comercio, nota, tags, modo ráfaga) — todo con default,
  nada obligatorio
- C5/C6: ingreso y transferencia (entre monedas partida en dos pasos: salida en pantalla,
  entrada confirmada en sheet; nunca cuenta como gasto ni ingreso)
- C7: guardado y deshacer en 4 frames, ≤700 ms, interactivo desde el frame 1
- C8: modo ráfaga con `Switch` real y contador, para cargar varios gastos sin volver a home
- C9: captura por voz (Web Speech API, parser rioplatense, todo editable antes de confirmar)
- C11: los tres badges — pendiente de sincronizar, sin conversión (`needs_fx`), rechazado —
  ninguno cancela el guardado
- **Invariante duro**: guardar no puede fallar. Sin red o sin tipo de cambio disponible, el
  movimiento se guarda igual (`needs_fx`); no existe el estado "no se guardó", solo "no se subió"
- Defaults inteligentes: cuenta más usada en la categoría con fallback a la última,
  frecuentes ponderadas por hora/día, comercio autocompletado desde `payees`

### Bloque B — Home y navegación (Fase 6)

- Home (B1) en sus variantes por flags ortogonales (monedas > 1, miembros > 1, módulos
  activos): hero de una cifra (patrimonio neto, con delta y sparkline) → tira de cuentas con
  snap → estado del mes → una insight card → últimos 5 movimientos
- Estados vacío, skeleton, offline con contador, scope abierto
- Tab bar con FAB central y regla del cuarto slot elegible (Análisis por default) — la
  navegación nunca se reconfigura sola
- Búsqueda global (`/buscar`, B8) agrupada por movimientos, cuentas, categorías y comercios

### Bloque D — Movimientos (Fase 7)

- Lista agrupada por día, headers sticky, resumen del período, virtualizada
  (`@tanstack/react-virtual`)
- Swipe para editar/borrar con deshacer de 5 s (equivalente por tap en el detalle)
- Filtros en bottom sheet con contador de resultados en vivo; calendario del mes con total
  por día; selección múltiple
- Sin un solo separador de fila ni borde de caja: densidad resuelta con espaciado y
  tipografía. Gastos en tinta neutra; el aqua reservado solo para ingresos; transferencias
  marcadas "no suma al total"
- Detalle de movimiento con el rate de cambio usado, su fuente y badge `needs_fx` cuando
  corresponde

### Bloque E — Cuentas y monedas (Fase 8)

- Lista de cuentas agrupada por moneda con subtotales; detalle con evolución del saldo a 90
  días; nueve tipos de cuenta con campos condicionales (incluye tarjeta de crédito: ciclo,
  cierre, vencimiento, proyección)
- Conciliación de saldo; monedas y tipos de cambio por par (proveedor, cotización preferida,
  override manual con vigencia, histórico)
- Resolución en lote de tipos de cambio pendientes (`/cuentas/resolver-fx`), la vista que
  cierra el estado `needs_fx`
- Estados: sin cuentas, rate viejo, API caída — nunca bloquean la pantalla

### Bloque A — Onboarding y auth (Fase 9)

- Camino crítico recortado: auth → país → uso (define si el grupo familiar arranca
  encendido) → primera cuenta → éxito → primer gasto. Google/Apple como camino visualmente
  principal (simulados, sin backend real todavía), magic link como alternativa
- Saldo inicial de la cuenta e instalación de la PWA se piden **después** del primer gasto,
  nunca antes — el primer contacto real con el keypad es el gasto, no un formulario
- Abandono a mitad de camino: al volver, entra directo a un home vacío con cuenta "Efectivo"
  por default; el onboarding no se repite
- Al terminar: household + primera cuenta con saldo inicial + plantilla de categorías Básica,
  todo en una sola transacción de Dexie
- Atajo "Probar con datos de ejemplo" para construir B/D/E antes de tener el flujo completo

### Responsive — tablet y desktop

- Navegación: `Sidebar` fijo a partir de `md`, reemplaza la `TabBar` inferior (mismos tabs,
  mismo handler)
- Contenido en una sola columna centrada (`--content-max-width`) en cualquier tamaño de
  pantalla — nunca multi-columna
- `ScreenShell` para las rutas standalone (onboarding, `/agregar` sin modal); `Sheet` capado a
  `position: relative` de su contenedor para no desbordar en pantallas grandes

### PWA — auditoría de instalación

- Service worker migrado de `@serwist/next` (nunca generaba `sw.js` real bajo Turbopack) a
  `@serwist/turbopack` (`createSerwistRoute` en `src/app/serwist/[path]/route.ts`), con
  `defaultCache` + fallback de navegación a `/offline`
- Registro manual del service worker (`ServiceWorkerRegister`, Serwist no lo inyecta solo a
  diferencia de `next-pwa`)
- Assets de marca completos desde `perze-brand/`: íconos `any`/`maskable`/`monochrome`,
  splash screens de iOS generados por dispositivo (`scripts/generate-splash-screens.mjs`,
  cubre el catálogo vigente de iPhone/iPad), `apple-touch-startup-image` vía Metadata API
- `manifest.webmanifest`: sin lock de orientación portrait, shortcut "Cargar un gasto" con
  ícono propio (`scripts/generate-shortcut-icon.mjs`, ícono de la app + insignia violeta con
  "+"), `metadataBase` configurado para que las URLs de `og:image` resuelvan en producción

### Migración de íconos: Lucide → Phosphor

- `design-system/core/Icon.tsx` migrado íntegro de `lucide-react` a `@phosphor-icons/react`
  (variante `/dist/ssr` para no forzar `"use client"` en las pantallas que lo consumen desde
  Server Components), preservando la API pública (`IconName`, props de `Icon`)
- Ícono propio para cuenta corriente (`bank`), distinto de caja de ahorro (`piggy-bank`) —
  antes ambos compartían el mismo glifo genérico y se veían igual en la lista de cuentas y en
  el picker de cuenta de la captura
- `lucide-react` eliminado por completo del `package.json`; los toasts de `sonner.tsx`
  migrados a sus equivalentes Phosphor; borrados los componentes de `shadcn/ui` que quedaron
  sin uso (`sheet`, `command`, `select`, `dialog`, `dropdown-menu`) por ser la única otra
  fuente de imports de Lucide en el repo

### Testing

- 4 tests E2E (Playwright, viewport mobile 390×844): gasto en 2 taps con cronómetro, gasto en
  moneda extranjera sin cotización disponible (`needs_fx`), 3 gastos con la red cortada y
  reconexión sin duplicados, onboarding completo → primer gasto en menos de 90 s
- Suite de Vitest existente (dominio, repos, componentes) manteniendo cobertura sobre
  `lib/money`, `lib/fx` y sus fallbacks, y la máquina de estados del borrador de captura

### Pendiente

- Backend real (Supabase: Postgres, Auth, Storage, Realtime, Edge Functions) — hoy todo es
  local-first sobre Dexie
- Bloques F en adelante (Presupuestos, Metas, Recurrentes, Deudas, Inversiones, Grupo
  familiar) y features diferidas de captura (C4 completo, C10 foto de ticket)
- Ajustes / Importar-Exportar / Acerca de siguen como stubs
- `src/app-old/` (MVP `[0.1.0]`/`[0.1.1]`) sigue en el repo, ignorado por git, pendiente de
  borrado definitivo al cerrar el bloque A original del plan

---

## [0.1.1] — 2026-05-30

Resuelve los cuatro ítems pendientes de la Fase 0 identificados en la revisión de código.

### Corregido

#### PWA — íconos PNG generados correctamente

- Generados `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png` a partir del SVG existente con `sharp`
- El ícono maskable incluye fondo esmeralda con 10 % de safe-zone (contenido al 80 %) según la especificación W3C
- `manifest.webmanifest` actualizado: 4 entradas separadas con `purpose` correcto (`"any"` y `"maskable"` como entradas distintas)
- El PWA ahora puede instalarse correctamente en Android/Chrome

#### Auth — contraseñas hasheadas en lugar de texto plano

- Introducido `src/lib/hash.ts` con hash FNV-1a 32-bit + salt de aplicación, sincrónico y sin dependencias externas
- `auth-store` actualizado: el campo `_passwordHash` reemplaza a `_password`; ninguna contraseña en texto plano se persiste en localStorage
- Login, registro y reset de contraseña actualizados para comparar/guardar el hash
- `partialize` explícito en el persist documenta qué se almacena; los hashes de contraseña se almacenan (para permitir login tras recarga) pero nunca el texto plano
- Nota: sigue siendo mock — la autenticación real con Supabase Auth se implementa en Fase 6

#### `formatMoney` — negativos con signo correcto

- `src/lib/money.ts`: separa el signo antes de formatear con `Math.abs(amount)`, produciendo `-$1.200` en lugar de `$-1.200`
- Comportamiento ahora consistente con `formatCompact` que ya lo manejaba correctamente

#### Validación en mutaciones del store de transacciones

- Creado `src/lib/schemas.ts` con `TransactionSchema` (Zod) como única fuente de verdad para la estructura de una transacción
- `transactions-store` actualizado: `addTransaction` y `updateTransaction` validan con Zod antes de persistir; retornan `{ success, error? }` en lugar de `void`/`Transaction`
- `transaction-sheet.tsx` actualizado para manejar los nuevos tipos de retorno
- También corregido el bug BUG-M2: `getRecentTransactions` ahora ordena por `t.date` (fecha real de la transacción) en lugar de `createdAt`

### Técnico

- Instalado `sharp@0.34.5` como devDependency para generación de íconos
- Script de generación de íconos en `/tmp/gen-icons.mjs` (puede incorporarse a `postinstall` en el futuro)

---

## [0.1.0] — 2026-05-30

Primera versión funcional de la app. MVP completo con todas las secciones principales, diseño fintech premium, soporte multi-moneda/multi-país e integración con IA de Gemini.

### Infraestructura y stack

- Scaffold con **Next.js 16.2** (App Router, Turbopack en dev, webpack en build)
- **Tailwind v4** con sistema `@theme inline` y variables OKLCH
- **shadcn/ui** inicializado y customizado: button, card, input, select, sheet, dialog, tabs, switch, dropdown, badge, avatar, calendar, command, popover, skeleton, sonner, progress, scroll-area, tooltip
- **Zustand 5** con `persist` middleware a localStorage para todos los stores
- **TypeScript** estricto en todo el proyecto
- **pnpm** como package manager
- **PWA** via Serwist (service worker, manifest, soporte offline)
- Fuente **Outfit** (Google Fonts) para toda la UI; Geist Mono para código

### Sistema de diseño

- Tema **claro/oscuro** con toggle y soporte de preferencia del sistema
- **5 colores de acento** configurables: esmeralda (default), violeta, azul, rosa, ámbar
- Acento aplicado vía clases CSS en el `<html>` por el `Providers` component
- Fondo dark: azul-gris profundo `oklch(0.095 0.018 265)` (no negro puro)
- Fuente Outfit cargada correctamente vía variable CSS `--font-outfit` (corrige bug de referencia circular del scaffold)
- Colores semánticos por tipo de transacción: `--income` (esmeralda), `--expense` (rojo), `--investment` (azul)
- `suppressHydrationWarning` en `<html>` y `<body>` para compatibilidad con extensiones de browser
- `dark accent-emerald` como clases SSR por defecto en el `<html>` para evitar flash de tema incorrecto

### Modelo de datos (`src/lib/types.ts`)

- `Currency` — código, nombre, símbolo, decimales. Defaults: USD, ARS, UYU, EUR
- `Country` — código, nombre, emoji bandera, monedas habilitadas. Defaults: Argentina (AR), Uruguay (UY)
- `ExchangeRate` — cotización relativa a USD como pivote (carga manual, arquitectura lista para API)
- `Category` — id, nombre, ícono (lucide), tipo, color. 22 categorías default (ingresos, gastos, inversiones)
- `Transaction` — id, tipo (income/expense/investment), monto, moneda, país, categoría, fecha, descripción, notas, source (manual/ai-receipt), createdAt
- `User` (mock) — id, nombre, email, createdAt
- `AccentColor` — union type de 5 acentos
- `Theme` — "light" | "dark" | "system"

### Stores Zustand (`src/stores/`)

- **`auth-store`** — autenticación mock local: register, login, logout, requestPasswordReset, resetPassword, updateProfile. Usuarios y sesión persistidos en localStorage (mock únicamente, no para producción)
- **`settings-store`** — moneda de visualización, tema, acento, lista de monedas y países configurados
- **`rates-store`** — tasas de cambio manuales con upsert por código de moneda
- **`categories-store`** — CRUD de categorías con seed de las 22 categorías default
- **`transactions-store`** — CRUD de movimientos con `crypto.randomUUID()` para IDs y `getRecentTransactions`
- **`analysis-store`** — análisis IA persistido: análisis actual + historial de hasta 10 análisis anteriores con fecha y snapshot de datos

### Utilidades (`src/lib/`)

- **`money.ts`** — `formatMoney` (Intl.NumberFormat por locale), `convertAmount` (conversión via pivote USD, retorna null si falta la tasa), `formatCompact` (sufijos K/M/B), `getCurrencyDisplay`
- **`aggregations.ts`** — `filterTransactions` (7 criterios), `computeTotals` (net = income - expenses - investments), `groupByMonth`, `groupByCategory`, `groupByCountry`

### Autenticación (`src/app/(auth)/`)

Layout con panel split en desktop: izquierda con branding/gradiente, derecha con el formulario.

- **`/login`** — email + contraseña, link a recuperar, redirección post-login
- **`/registro`** — nombre, email, contraseña, confirmación, redirección post-registro
- **`/recuperar`** — ingreso de email, mensaje neutral de confirmación
- **`/restablecer`** — nueva contraseña + confirmación, email prellenado por query param

Todas las páginas usan react-hook-form + Zod para validación. El logo se oculta en desktop donde ya aparece en el panel izquierdo.

### App layout (`src/app/(app)/layout.tsx`)

- Guard de autenticación con `useEffect` post-hidratación (evita redirect race con Zustand persist)
- Spinner de carga durante la ventana de hidratación (nav siempre visible)
- `<BottomNav />` renderizado incondicionalmente para que aparezca en todas las rutas

### Bottom navigation (`src/components/bottom-nav.tsx`)

- 4 items + botón central: Inicio · Movimientos · **+** · Análisis · Ajustes
- Indicador de ítem activo: barra de 3px sobre el ícono en color acento
- Botón central (+): círculo con glow de acento, navega a `/movimientos?new=true`
- Fondo con `backdropFilter: blur` y sombra ascendente para distinguirse del contenido
- `safe-area-inset-bottom` para iOS

### Dashboard (`/`)

- Saludo con hora del día + nombre del usuario; fecha en español
- Selector de período: Este mes / 3 meses / Este año
- **Hero card**: balance neto en grande (text-5xl), mini-stats (ingresos/gastos/inversiones), selector de moneda de visualización, patrón de puntos decorativo
- Breakdown **Por país**: tarjetas scrollables con bandera, nombre y balance neto por país (net = income - expenses - investments)
- **Gráfico de últimos 6 meses**: BarChart de Recharts con 3 barras por mes (ingresos/gastos/inversiones), leyenda, tooltip customizado
- **Movimientos recientes**: últimos 5 ordenados por fecha, con ícono de categoría, descripción, fecha en español y monto con signo/color por tipo
- **Acciones rápidas**: 3 cards (Nuevo gasto / Nuevo ingreso / Nueva inversión) con colores semánticos
- Estado vacío con CTA cuando no hay transacciones

### Movimientos (`/movimientos`)

- Lista agrupada por fecha con headers ("Hoy", "Ayer", nombre del día, fecha completa)
- **Pills de filtro rápido por tipo** sobre el listado: Todos / Gastos / Ingresos / Inversiones (con colores semánticos en activo)
- **Filter sheet** (desliza desde abajo): búsqueda por texto, país (con bandera), moneda (con símbolo), categoría, rango de fechas
- Selects del filtro con triggers customizados que muestran el valor legible ("Todos" cuando no hay selección, bandera+nombre para países, símbolo+código para monedas)
- **Chips de filtros activos** debajo del header, cada uno eliminable individualmente
- Contador de movimientos filtrados en el header
- Cada item: ícono de categoría en círculo coloreado, descripción + categoría, monto con signo y color, código de moneda y bandera del país
- Menú contextual por item: editar o eliminar con confirmación
- **Transaction Sheet** para alta/edición:
  - Tabs de tipo (Gasto/Ingreso/Inversión) con colores
  - Selector de moneda con símbolo en acento + código
  - Selector de país con emoji bandera + código
  - Input de monto en grande con símbolo de moneda
  - Grid visual de selección de categoría (4 columnas, íconos coloreados)
  - Date picker via Calendar + Popover
  - Campo de descripción y notas opcionales
  - Confirmación antes de eliminar en modo edición
  - Source `"ai-receipt"` para movimientos cargados desde análisis de ticket

### Inversiones (`/inversiones`)

- Hero card con total invertido en moneda de visualización
- Barra de distribución horizontal por categoría (segmentos proporcionales)
- Lista de categorías con barra de progreso individual y porcentaje
- Últimos 5 movimientos de tipo inversión
- Estado vacío con link a agregar inversión
- FAB en esquina inferior derecha para nuevo movimiento de tipo inversión

### Análisis IA (`/analisis`)

- Selector de período: Este mes / 3 meses / Todo
- Mini stats del período (ingresos/gastos/inversiones) en el header
- Botón "Generar análisis" / "Regenerar análisis"
- **Health score ring**: SVG circular con color según puntuación (≥81 verde, ≥61 teal, ≥41 ámbar, <41 rojo)
- Resumen ejecutivo del análisis
- Cards de oportunidad de ahorro
- **Alertas** con severity (high=rojo, medium=ámbar, low=verde)
- **Observaciones** por categoría con tipo (positive/warning/critical/info)
- **Sugerencias** con prioridad y acción concreta, borde de color por prioridad
- Timestamp del análisis generado
- **Historial** colapsable: hasta 10 análisis anteriores, cada uno expandible con score, resumen y primeras 2 sugerencias. Eliminación individual o total.
- Card feature "Escanear ticket" con link a `/escanear`
- Manejo de errores específico por tipo: quota agotada, API key inválida, modelo no disponible

### Escanear ticket (`/escanear`)

- Input de imagen con `capture="environment"` para cámara del dispositivo
- Preview de la imagen seleccionada con opción de cambiar
- Botón "Analizar con IA" deshabilitado hasta seleccionar imagen, con spinner durante análisis
- Resultado: comercio, confianza (badge verde/amarillo/rojo), fecha, moneda, tabla de items, subtotal/IVA/total
- Botón "Guardar como gasto" → abre TransactionSheet prellenado con datos del ticket
- Manejo de error cuando no hay API key (con link a Configuración)

### Configuración (`/configuracion`)

- **Perfil**: avatar con iniciales, edición de nombre inline, email, botón de logout
- **Apariencia**: selector de tema (3 botones), 5 círculos de color de acento, selector de moneda de visualización
- **Tipos de cambio**: lista de monedas con input de tasa por USD, timestamp de última actualización, tip específico para ARS (dólar blue)
- **Monedas configuradas**: lista con símbolo, badge "en uso", eliminar (con validación de uso activo), dialog para agregar nueva moneda
- **Países configurados**: lista con bandera, nombre, badges de monedas habilitadas, eliminar, dialog para agregar nuevo país

### API routes (`src/app/api/ai/`)

- **`/api/ai/insights`** (POST) — agrega summary financiero → Gemini 2.5 Flash → schema Zod `InsightsSchema` → respuesta estructurada (healthScore, observations, suggestions, alerts, savingsOpportunity)
- **`/api/ai/scan-receipt`** (POST, multipart) — imagen en base64 → Gemini 2.5 Flash Vision → schema Zod `ReceiptSchema` → merchant, date, currency, total, items[], category, confidence
- Manejo de errores diferenciado: quota (429), API key inválida (401), modelo no disponible (503)
- API key solo en servidor (`GEMINI_API_KEY` en `.env.local`)

### PWA

- `public/manifest.webmanifest` — nombre, short_name, start_url, display standalone, orientación portrait
- Service worker generado por Serwist en build (`pnpm build --webpack`)
- SW deshabilitado en desarrollo (evita conflicto con Turbopack)
- `turbopack: {}` en next.config.ts para silenciar advertencia en dev
- Meta `appleWebApp` para instalación en iOS
- Viewport `viewportFit: "cover"` para soporte de notch

### Fixes y ajustes iterativos (post-MVP)

- Corregido bug de referencia circular de fuente (`--font-sans: var(--font-sans)` → `var(--font-outfit)`)
- Corregido enrutamiento: eliminado `src/app/page.tsx` que impedía que `(app)/layout.tsx` aplicara al root `/` y ocultaba el BottomNav en el dashboard
- Corregido bug de hidratación Zustand: guard de auth con estado `hydrated` antes de redirigir
- Corregida inconsistencia en neto por país: `income - expenses - investments` (inversiones también son salida de efectivo)
- Eliminado FAB redundante de la página de movimientos (el botón + del BottomNav cumple la misma función)
- Corregido modelo de Gemini: `gemini-2.0-flash-exp` (deprecado) → `gemini-2.5-flash` (disponible con la API key configurada)
- Corregido `__all__` visible en selects de filtros: triggers customizados con display legible
- Agregadas pills de filtro rápido por tipo directamente sobre el listado de movimientos
- Análisis IA persistido en `analysis-store` con historial de hasta 10 análisis anteriores
- Inversiones incluidas en el gráfico de 6 meses del dashboard (tercera barra)

### Conocido y pendiente (ver `docs/plan-next-steps.md`)

- Contraseñas en texto plano en localStorage (mock — no usar en producción)
- Íconos PNG del PWA no generados (solo existe SVG; falla la instalación en Android)
- Rutas de IA sin autenticación (cualquiera puede consumir la cuota de Gemini)
- `formatMoney` produce `$-1.200` en negativos en lugar de `-$1.200`
- `useMemo` con `Date` inestables en el dashboard (memoización se invalida en cada render)
- Pérdida de datos al cerrar el sheet sin guardar (sin confirmación de descarte)

---

*Para el plan completo de próximas versiones ver [`docs/plan-next-steps.md`](docs/plan-next-steps.md).*
