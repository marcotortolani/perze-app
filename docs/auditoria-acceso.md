# Auditoría de acceso: onboarding, login, registro y multi-dispositivo

> Auditoría del 2026-08-02 sobre v0.7.1, pedida tras encontrar en producción que un
> usuario existente no podía volver a entrar desde otro navegador. Cubre todos los
> caminos de entrada a la app y su estado real en el código. Cada hallazgo lleva un
> ID `AC-n` y un estado: **corregido** (en la pasada v0.8.0 que acompaña este
> documento) o **pendiente** (con su razón). Este documento describe el código, no
> el diseño — el diseño de A2/A3/A4 sigue siendo la meta final
> (`docs/mejora-auth-oauth-y-email.md` § 0.1).

## El hallazgo estructural

**La sincronización era exclusivamente push.** El outbox de Dexie sube las
escrituras locales a Supabase (`src/lib/offline/sync-worker.ts`), pero no existía
ningún camino que bajara datos del servidor a un dispositivo. Consecuencia: toda
situación que produce una sesión válida sin datos locales — otro navegador, otro
dispositivo, borrar datos del sitio, aceptar una invitación, re-login después de
`signOut` (que borra la base local) — dejaba al usuario frente al onboarding de
alta, con dos salidas posibles: crear un household **duplicado** o (desde v0.7.1)
un freno sin salida (`/onboarding/existing-household`).

La corrección central de esta pasada es **`hydrateFromRemote()`**
(`src/lib/offline/hydrate.ts`): baja las once tablas sincronizadas del household
del usuario (households, members, accounts, categories, tags, payees,
transactions, budgets, goals, recurring_rules, rules) a la base Dexie local, con
los mismos cuidados de dinero que el camino de subida (`bigint` por `::text`,
rates por `parseRate`, nunca un `number` para plata).

## Matriz de casos de uso

| # | Caso | v0.7.1 (antes) | v0.8.0 (ahora) |
|---|------|----------------|-----------------|
| 1 | Nuevo, primer ingreso | Welcome → A2 → mail → link → registro (nombre+contraseña) → A4 país → A5 uso → A6 cuenta → A11 → app | Igual (ya funcionaba) |
| 2 | Nuevo, abre el link del mail en **otro navegador** | El canje PKCE falla → A2 con aviso y reintento | Igual — límite inherente de PKCE, el aviso propone pedir el link desde el navegador original |
| 3 | Existente, mismo dispositivo, sesión viva | Entra directo a la app | Igual |
| 4 | Existente, mismo dispositivo, sesión vencida, recuerda contraseña | Proxy → `/login` (cookie `perze_registered`) → contraseña → app | Igual |
| 5 | Existente, mismo dispositivo, **no recuerda** contraseña | `/login` → "Olvidé mi contraseña" → mail → `/reset-password` → app | Igual |
| 6 | Existente, **otro dispositivo**, recuerda contraseña | A2 sin link a login (solo el toggle poco visible); tras entrar, freno sin salida | A2 tiene "Ya tengo cuenta" → `/login` → contraseña → `/onboarding/restore` **hidrata** → app con sus datos |
| 7 | Existente, **otro dispositivo**, no recuerda contraseña | Sin camino a `/forgot-password` desde A2 → doble callejón | "Ya tengo cuenta" → `/login` → "Olvidé mi contraseña" → recovery → `/reset-password` → restore → app |
| 8 | Existente, otro dispositivo, entra por **magic link** | Link → registro detecta `registration_completed_at` → freno | Igual hasta la detección → restore → app |
| 9 | **Invitado** acepta invitación en dispositivo sin datos | `accept_invite` solo escribía `meta.currentHouseholdId` → rebotaba a onboarding y podía duplicar household | `/join` hidrata el household aceptado y entra a la app |
| 10 | Usuario **pending** (sin aprobación del operador) | `/pending` correcto, pero con PIN activo la pantalla quedaba detrás del candado | `/pending` (y login/forgot/reset) exentas del PIN |
| 11 | Demo → registro real | Wipe del demo + flujo de alta | Igual (v0.6.1) |
| 12 | Dos cuentas distintas en el **mismo navegador** (base legacy) | La salvaguarda de migración nunca namespacea → riesgo de ver datos ajenos | **Pendiente** (AC-5) — mitigado porque `signOut` borra la base; el residual es el cambio de sesión sin sign-out |
| 13 | Sesión válida + datos del sitio borrados a mano | Como el caso 6 | Como el caso 6 → restore |
| 14 | Deploy nuevo con PWA instalada (SW con caché vieja) | Posible loop de recarga hasta limpiar el SW | **Pendiente** (AC-16) — operativo, no de flujo; mitigación de SW aparte |

## Hallazgos

### Críticos (bloqueaban el acceso multi-dispositivo)

- **AC-1 — No existía pull-sync** (`BASE-05` diferido). Cualquier sesión sin Dexie
  poblado moría en el onboarding. **Corregido**: `hydrateFromRemote()` +
  `/onboarding/restore`, que reemplaza al freno `/onboarding/existing-household`.
- **AC-2 — `/join` no traía nada del household aceptado.** Solo escribía
  `meta.currentHouseholdId`; `useCurrentHousehold` devolvía `null` y el invitado
  rebotaba al onboarding sin poder llegar jamás al household que aceptó.
  **Corregido**: hidratación scoped al household de la invitación.
- **AC-3 — `profiles.default_household_id` no se escribía ni leía nunca.** El
  household activo vivía solo en `meta` de Dexie — exactamente el dato que un
  dispositivo nuevo necesita es el único que nunca salía del dispositivo.
  **Corregido**: se escribe (best-effort) al cerrar A11 y la hidratación lo usa
  para elegir el household activo.
- **AC-4 — `DbOwnerSync` cambiaba de base Dexie sin invalidar React Query.** Con
  `staleTime: Infinity`, un household cacheado contra la base anónima seguía
  sirviéndose después del cambio a `perze-<uid>`. **Corregido**: invalidación del
  cache al cambiar de base.

### De flujo y descubribilidad

- **AC-7 — A2 no tenía "Ya tengo cuenta".** El único camino al login con
  contraseña era el toggle "Prefiero usar mi contraseña", que no lleva a
  `/forgot-password` ni setea la cookie. Pedido explícito del flujo original.
  **Corregido**: link "Ya tengo cuenta" → `/login` en A2.
- **AC-8 — El login con contraseña desde A2 no seteaba `perze_registered`.** Un
  usuario que entraba por ahí volvía a ver la pantalla de alta al vencer la
  sesión. **Corregido**: se marca la cookie en ese camino y cuando A2 detecta una
  sesión ya existente.
- **AC-9 — `resolveOnboardingDestination()` sin manejo de error.** Si el chequeo
  remoto fallaba (sin red, Supabase pausado), la promesa rechazaba dentro del
  efecto y el usuario quedaba en A2 sin ningún feedback. **Corregido**:
  try/catch con aviso y reintento en A2 y en el registro.
- **AC-11 — El PIN bloqueaba `/login`, `/forgot-password`, `/reset-password` y
  `/pending`.** Pantallas sin datos sensibles que además pueden pertenecer a otra
  cuenta que la del PIN local. **Corregido**: agregadas a la lista de exentas.
- **AC-15 — `hasRemoteHousehold()` contaba households soft-deleted** (la policy
  de SELECT ya no filtra `deleted_at`, a propósito). Un household borrado
  disparaba el freno para siempre. **Corregido**: `.is("deleted_at", null)`.

### Pendientes (documentados, no resueltos en esta pasada)

- **AC-5 — Salvaguarda legacy pegajosa** (`db-owner-sync.tsx`): si la base
  anónima `perze` tiene un household no-demo, ese navegador no namespacea nunca,
  para ningún usuario. Riesgo: una segunda cuenta en el mismo navegador ve los
  datos de la primera si hubo cambio de sesión sin pasar por `signOut` (que sí
  borra la base). Tocarlo exige decidir qué pasa con los datos legacy reales —
  fuera del alcance de esta pasada.
- **AC-6 — Dos efectos de redirect independientes** sobre `household === null`:
  `OnboardingGate` y `(app)/layout.tsx` (este último decide además
  welcome-vs-A2). Convergen en el mismo destino final, pero son dos fuentes de
  verdad para la misma decisión. Unificarlos es refactor de shell, no urgente.
- **AC-12 — Preferencias de UI solo locales.** Cuarto tab, scope, tema,
  intensidad de motion, modo privacidad, tooltips vistos y PIN viven en
  localStorage del dispositivo. `profiles.settings` y `households.settings`
  existen en Postgres y nada los usa. Un dispositivo nuevo arranca con defaults
  — aceptable para preferencias de dispositivo (PIN, motion), discutible para
  cuarto tab y scope. Sincronizarlos vía `profiles.settings` es trabajo aparte.
- **AC-13 — Tablas remote-only no necesitan hidratación** (splits, shares,
  settlements, deudas, inversiones, statements, notificaciones): sus repos leen
  Supabase directo y funcionan en cualquier dispositivo apenas el household
  resuelve. Verificado, sin acción.
- **AC-14 — La hidratación es de una sola vez, no continua.** Cambios hechos en
  el dispositivo A *después* de que B hidrató no llegan a B (no hay realtime ni
  pull incremental; no existe índice sobre `updated_at` para un cursor). El
  multi-dispositivo *simultáneo* sigue siendo trabajo futuro; esta pasada
  resuelve el acceso y la restauración inicial.
- **AC-16 — SW con caché vieja tras deploy** puede loopear recargas hasta
  limpiar el service worker (visto en producción el 2026-08-02). Mitigación
  (detección de chunk faltante → update forzado) es trabajo aparte del flujo de
  acceso.

## Adenda post-deploy (v0.8.1): por qué "no había nada que restaurar"

Probando v0.8.0 en producción, la restauración "no funcionó" — y la base remota
resultó estar **completamente vacía** (0 households, 0 cuentas, 0 movimientos)
pese a varios onboardings completados. La hidratación funcionaba; lo que nunca
funcionó fue la **subida**. Dos hallazgos nuevos:

- **AC-17 — el `upsert` del sync-worker moría con RLS en el primer insert,
  siempre.** `supabase.from(t).upsert(row)` genera `INSERT ... ON CONFLICT`, y
  bajo RLS esa forma exige poder ver/actualizar la fila en conflicto. Para un
  household recién creado, la membresía todavía no existe
  (`current_households()` vacío hasta que sincronice el member) → 42501 → 8
  reintentos → dead-letter, y toda la cola detrás (member, cuentas, categorías
  y movimientos dependen de ese household). Verificado contra el proyecto
  remoto: `INSERT` plano ✅ · `ON CONFLICT DO NOTHING` ❌ · `ON CONFLICT DO
  UPDATE` ❌ sin membresía / ✅ con membresía. **Corregido**: op `insert` usa
  `INSERT` plano con `23505` (duplicate key) tratado como "ya sincronizada";
  op `update` conserva el `upsert` (a esa altura la membresía existe).
- **AC-17b — el loop de sync moría en silencio para toda la sesión.** En
  `use-sync-loop.ts`, `outbox.count()` corría fuera de todo catch: un rechazo
  suyo (típico: `DatabaseClosedError`, porque `DbOwnerSync` cierra/borra la
  base Dexie justo en el login) tumbaba la promesa del tick antes de re-armar
  el timer. **Corregido**: try/finally — el timer se re-arma siempre.
- Consecuencia operativa: los dispositivos con datos viejos tienen la cola en
  `dead`. La pantalla de diagnóstico (Más → Sincronización) suma **"Reintentar
  todas"** para resucitarla de un tap después de deployar el fix.

## Decisiones de la hidratación (para quien la toque después)

- **Fidelidad sobre filtrado**: se bajan también filas soft-deleted (con su
  `deletedAt`) — los repos locales ya saben filtrarlas y así el estado local es
  espejo del servidor.
- **`current_balance` se toma del servidor tal cual** (`::text` → `bigint`), no
  se recomputa localmente: RLS (`can_see`) puede ocultar cuentas o movimientos
  ajenos, y un recompute local con datos parciales daría un saldo falso.
- **`i18nKey` de categorías se reconstruye por nombre** desde
  `BASIC_CATEGORY_TEMPLATE` (no existe columna en Postgres, igual que en el
  backfill de la versión 2 de Dexie).
- **Todo monto viaja como texto** (`amount::text`) — PostgREST serializa
  `bigint`/`numeric` como número JSON y arriba de 2^53 se pierde precisión en
  silencio. Mismo patrón que `mirror-repo.ts` y `debts-repo.ts`.
- **Los `bulkPut` corren dentro de `withoutOutbox()`**: hidratar no debe
  encolar nada — esos datos *vienen* del servidor.
- **`transactions` se pagina** (PostgREST corta en 1000 filas en silencio);
  el resto de las tablas también, por uniformidad.
- **Guard de no-clobber**: la hidratación completa corre solo con la base local
  vacía de households; la scoped (invitación) solo toca el household nuevo. Un
  dispositivo con ediciones pendientes en el outbox nunca es pisado.
