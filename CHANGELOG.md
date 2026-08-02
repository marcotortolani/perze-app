# Changelog

Todos los cambios notables de este proyecto están documentados en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

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
