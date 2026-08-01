# Auditoría técnica — plan de resolución

**Fecha:** 2026-08-01 · **Estado del repo:** rama `main`, post-cierre de diseño, pre-GATE de pantallas.

Auditoría profunda ejecutada por cinco auditores independientes en paralelo sobre el código real (no sobre los documentos de diseño):

| Área | Alcance | Hallazgos |
|---|---|---|
| **A** — Datos | Migraciones SQL, RLS, `lib/money`, cadena FX, `needs_fx`, outbox | 20 |
| **B** — Auth | Registro OTP, login, onboarding, protección de rutas, PIN, sesión | 23 |
| **C** — PWA | Service worker, cache, Dexie, sync, TanStack Query, bundle | 34 |
| **D** — i18n/A11y | Catálogos ES/EN/PT, formateo, WCAG, semántica, teclado | 29 |
| **E** — Server | Edge Functions, push, cron, `config.toml`, secretos | 20 |

**126 hallazgos brutos → ~110 problemas únicos** tras deduplicar. Varios críticos fueron encontrados de forma independiente por dos o tres auditores — señal de alta confianza, no de redundancia.

Los IDs (`A1`, `B5`, `C13`…) son estables: citarlos por ID, no por posición.

## Mapa de deduplicación

| Hallazgo canónico | Duplicados absorbidos |
|---|---|
| B1 (sin gate de sesión) | B2, E8 |
| B3 (fallback a usuario demo) | C2 |
| B4 (sin logout / Dexie compartida) | C1, E7 |
| B5 (`/api/fx` abierto) | A9, E6 |
| B8 (lockout de PIN evadible) | C23 (parte lockout) |
| B12 (hash de PIN débil) | C23 (parte hash) |
| B9 (rutas fuera del PinGate) | C22 (variante shortcut, se lista aparte) |
| A14 (`accept_invite` débil) | E5 (lo amplía con evidencia extra) |

## Tabla de severidades

| Severidad | Cantidad | Criterio |
|---|---|---|
| **Crítico** | 18 | Corrupción o pérdida de datos, fuga de datos financieros, secretos expuestos, build/deploy roto, WCAG nivel A roto en el camino principal |
| **Alto** | 30 | Integridad multi-usuario, sync no confiable, escaladas de privilegio, bloqueos de tarea |
| **Medio** | ~42 | Robustez, funcionalidad prometida sin motor, deuda de UX |
| **Bajo** | ~20 | Consistencia, higiene, deuda menor |

---

## Hallazgos críticos

### E3 — Secretos en la imagen Docker (rotar claves YA)

**Evidencia:** `.env.local` líneas 2, 4 y 18 contienen `GEMINI_API_KEY`, `SUPABASE_ACCESS_TOKEN` y `VAPID_PRIVATE_KEY`. `Dockerfile:20` hace `COPY . .` y **no existe `.dockerignore`**.

`SUPABASE_ACCESS_TOKEN` es un personal access token: control total de **todos** los proyectos de la cuenta Supabase (leer, modificar, borrar). La VAPID privada permite firmar pushes válidos hacia todos los suscriptores de PERZE.

`.gitignore` sí cubre `.env*` y el historial de git está limpio (verificado con `git log` y `git grep` sobre todo el historial) — pero Docker no lee `.gitignore`: cualquier `docker build` desde este directorio hornea los tres secretos en la capa del stage `builder`, recuperables con `docker history` / `docker save` aunque el stage `runner` no los copie. Contradice a `.env.example:14-15` ("la privada NUNCA va acá") y a `docs/plan-de-trabajo.md:766`.

**Fix:** (1) rotar las tres claves asumiéndolas comprometidas; (2) crear `.dockerignore` con `.env*`, `.git`, `node_modules`, `.next`; (3) sacar `SUPABASE_ACCESS_TOKEN` y `VAPID_PRIVATE_KEY` de `.env.local` — van en el shell/keychain y en secrets de la Edge Function respectivamente.

### A1 — Los rates FX suben a Postgres multiplicados por 10¹²

**Evidencia:** `src/lib/offline/sync-config.ts:179-188`:

```ts
fx_rate: p.fxRate === null ? null : bigintToString(p.fxRate),
original_rate: p.originalRate === null ? null : bigintToString(p.originalRate),
counter_fx_rate: p.counterFxRate === null ? null : bigintToString(p.counterFxRate),
```

`p.fxRate` es un `ScaledRate` (`src/lib/fx/rate.ts:5-13`: `bigint` = valor × 10¹²). Las columnas destino son `numeric(24,12)`. Un rate de `1050.00` viaja como `"1050000000000000"` y queda persistido como 1.050.000.000.000.000. El serializador correcto — `formatRate()` (`rate.ts:27`) — se usa en `/api/fx` pero no está importado en `sync-config.ts`.

**Impacto:** todo movimiento en moneda distinta a la base sube con un `fx_rate` 10¹² veces mayor. `amount_base` sí va bien (bigint), así que la inconsistencia es silenciosa hasta que algo reconcilie desde el servidor: recálculos, exports, un segundo dispositivo.

**Fix:** usar `formatRate()` en los tres campos + test de round-trip `parseRate(formatRate(r)) === r` contra el payload del outbox. Incluye saneo del remoto (ver [Datos ya dañados](#datos-ya-dañados-en-el-remoto)).

### A3 — Rate 1 inventado en la conversión de captura

**Evidencia:** `src/features/capture/save-transaction.ts:43-64` (idéntico en `src/features/movements/update-transaction.ts:37-55`). Si la conversión de captura no resuelve, `amount` queda con el valor de `capturedAmount` (unidades mínimas de la moneda capturada) pero se persiste con `currency_code` de la cuenta. Tipear **US$ 100** en una cuenta ARS sin cotización guarda **AR$ 100**. `original_amount`/`original_currency` quedan `NULL`, así que no hay rastro; el `amount` corrupto alimenta `current_balance` (trigger `recompute_account_balance`) y luego `amount_base`, que sí resuelve.

Es la prohibición de `docs/01-arquitectura-datos.md` § "Nunca hay un paso 5 con `rate = 1`", aplicada a la primera conversión — y peor que un `pending`, porque ningún banner de `needs_fx` lo señala.

**Fix:** cuando la conversión de captura no resuelve, guardar lo tipeado en `original_amount`/`original_currency` con `original_rate = NULL` y marcar el movimiento como pendiente de resolución de captura; nunca reinterpretar el número como moneda de cuenta.

### A4 — Toda edición recalcula `fx_rate` con la cotización de hoy

**Evidencia:** `src/features/movements/update-transaction.ts:66-78,113` incluye el bloque `fx` en el patch incondicionalmente: cambiar la nota o la categoría de un gasto de hace seis meses vuelve a correr la cadena de resolución y pisa el rate congelado (casi siempre con un `inherited` reciente, ver A7).

Además, **no existe `resolvePendingFx()` en ningún lado**: `transactionsRepo.listNeedingFx` lista los pendientes, pero no hay función que resuelva un `pending` (`NULL` → valor) ni que recalcule `amount_base` de `transaction_splits`/`transaction_shares` hijos. La única escritura legítima de un `amount_base` post-inserción es imposible de ejecutar hoy.

**Fix:** incluir `fx` en el patch solo si cambió `amount`, `accountId` o `currencyCode` **y** el `fxRate` previo era `NULL`; crear `resolvePendingFx(txId)` que además recalcule los hijos.

### C3 — El outbox pierde mutaciones: entrada `syncing` interrumpida queda huérfana

**Evidencia:** `src/lib/offline/outbox.ts:27-37` — `listPending()` solo levanta `pending` y `failed`; `markSyncing()` cambia el estado antes de `syncOne()`. Si la pestaña se cierra o el dispositivo se duerme entre esas dos líneas (lo normal en móvil), la entrada queda en `"syncing"` para siempre: no se reintenta, no se cuenta, el SyncDot muestra "todo bien".

**Fix:** al arrancar `drainOutbox`, resetear `status: "syncing"` → `"pending"` (o `syncingSince` con expiración).

### C4 — El encolado al outbox está fuera de la transacción Dexie

**Evidencia:** `src/lib/repos/transactions-repo.ts:68-77` — el `db.transaction("rw", …)` escribe la fila y ajusta el saldo; `await enqueueTransaction("insert", row)` corre **después**, fuera de la transacción. Mismo patrón en todos los repos (`accounts-repo.ts:37`, `categories-repo.ts:25`, `budgets-repo.ts:22`…).

**Impacto:** crash o cierre entre el commit y el enqueue deja la fila local sin entrada de outbox: el movimiento existe en el dispositivo y jamás va a existir en el servidor. No hay reconciliación posterior.

**Fix:** incluir `db.outbox` en la misma `db.transaction("rw", …)`.

### B3 — Fallback silencioso al usuario demo (`DEMO_USER_ID`)

**Evidencia:** `src/hooks/use-current-user.ts:36-42` devuelve `data ?? DEMO_USER_ID` — sin distinguir "todavía cargando" (`undefined`) de "no hay sesión" (`null`). Durante el primer render post-refresh también devuelve el id demo. Es el hook que consumen `accounts/new`, `AccountFormFlow` y `save-transaction`.

**Impacto:** toda escritura hecha en esa ventana queda con `created_by` = id demo, se encola, y **falla por RLS para siempre** (`created_by = auth.uid()`), con `attempts` creciendo sin límite. El caso de uso optimizado del producto — abrir el shortcut y tipear en menos de 5 segundos — es exactamente la ventana expuesta. Pérdida efectiva del gasto.

**Fix:** devolver `string | null | undefined` (undefined = cargando); todo llamador bloquea o difiere la escritura sin uid real; `DEMO_USER_ID` reservado al household sembrado por `seedDemoHousehold()`.

### B4 — No existe logout y la base Dexie se comparte entre usuarios

**Evidencia:** `grep -rn "signOut" src/` → cero resultados. `src/lib/db/client.ts:68` — `constructor(name = "perze")`: una sola base para cualquier usuario del navegador. `householdsRepo.setCurrentHouseholdId()` guarda el household activo en `meta` sin discriminar por usuario.

**Impacto:** si el usuario B inicia sesión donde estuvo A, ve todos los movimientos, cuentas y saldos de A (el gate de B1 pasa, porque hay household local), y el outbox intenta empujar las filas de A bajo la sesión de B. La suscripción de push además sobrevive: el dispositivo sigue recibiendo notificaciones con montos de un household al que ya no se pertenece (E7).

**Fix:** `signOut()` que haga `supabase.auth.signOut()` + `db.delete()` + limpieza de stores persistidos y caches del SW + `unsubscribeFromPush()`; base Dexie namespaced por usuario (`perze-${userId}`).

### B1 — Sin protección de rutas basada en sesión

**Evidencia:** `src/app/(app)/layout.tsx:49-55` + `src/components/onboarding-gate.tsx:20-25`: la condición de acceso a toda la app es "existe una fila `households` en Dexie", no "hay sesión válida" — `useCurrentHousehold()` nunca toca `supabase.auth`. Los 74 archivos de `(app)/**` son `"use client"`; no hay un solo check de auth server-side. Y `src/proxy.ts:34-38` — el único punto server-side que ve la sesión — hace `await supabase.auth.getUser()` y **descarta el resultado**: nunca hay redirect.

**Impacto:** con sesión vencida, revocada o inexistente, cualquiera con acceso al perfil del navegador ve el shell completo con saldos, movimientos y análisis locales. La expiración de token no expulsa a nadie.

**Fix:** en `proxy.ts`, redirect a `/onboarding` cuando `getUser()` devuelva `null` para todo path fuera de `/onboarding|/auth|/join|/offline|/api/fx` (devolviendo la misma `response` para no perder las cookies refrescadas); el gate del cliente pasa a depender de `useCurrentUserId()` real.

### B5 — `/api/fx` abierto: sin auth, con inyección, cacheado 24 h por el SW

**Evidencia:** `src/app/api/fx/route.ts:57,84`:

```ts
const date = searchParams.get("date") ?? todayIso();
// ...
.or(`valid_to.is.null,valid_to.gte.${date}`)
```

`date` crudo del querystring interpolado en la cadena de filtro de PostgREST (`?date=2026-01-01,rate.gte.0` reescribe el `.or()`). Sin `getUser()`; `base`/`quote`/`householdId` sin allowlist. `src/lib/fx/providers/frankfurter.ts:23` interpola sin `encodeURIComponent` (inyección de parámetros en el upstream). Como nada escribe jamás en `fx_rates` (E9a), `hasFreshToday` es siempre falso y **cada request anónimo dispara fetches salientes** a dolarapi/frankfurter: amplificación gratuita y riesgo de baneo por IP.

Además el `defaultCache` de Serwist (`src/app/sw.ts:26`) cachea `/api/*` con NetworkFirst 24 h: la respuesta con overrides del household queda en CacheStorage sin purga (no hay logout), y `fx-repo.ts:137-147` re-sella la copia cacheada con `fetchedAt: nowIso()` — una cotización de ayer persiste como de hoy.

**Fix:** `getUser()` obligatorio (401 sin sesión) + Zod (`date` ISO, `base`/`quote` contra el catálogo de `currencies`, `householdId` uuid) + `encodeURIComponent` en los providers + `Cache-Control: no-store` + regla `NetworkOnly` explícita en el SW antes de `...defaultCache` + respetar `data.asOf` al sellar el cache local.

### E1 — `send-push` invocable por cualquiera, hacia cualquier household

**Evidencia:** `supabase/functions/send-push/index.ts:43-48` — `householdId` viene crudo del body y se usa con el cliente `service_role` (bypass total de RLS). No hay `getUser()` ni comparación contra `household_members`. `supabase/config.toml` no tiene sección `[functions]`: el gate default de la plataforma acepta como JWT la **anon key**, publicada en el bundle.

**Impacto:** con un `household_id` (UUID v7, no secreto: viaja en URLs y payloads) un tercero manda notificaciones arbitrarias a todos los dispositivos de esa familia.

**Fix:** resolver el usuario desde `Authorization` y abortar 403 si no es miembro del household; declarar `[functions.send-push] verify_jwt = true` en `config.toml`.

### E2 — Payload de push sin validar + `openWindow` de cualquier URL

**Evidencia:** `send-push/index.ts:75` arma el payload con `title`/`body`/`url` del invocador tal cual; `src/app/sw.ts:60-63` hace `self.clients.openWindow(url)` sin validar origen — acepta `https://perze-fake.tld/login`.

**Impacto:** encadenado con E1, phishing con el ícono y nombre de PERZE ("Verificá tu cuenta") que abre un sitio del atacante.

**Fix:** en la función, validar `url` como ruta relativa; en el SW, resolver con `new URL(url, self.location.origin)` y rechazar si el origin no coincide.

### A2 — La cadena de migraciones no aplica desde cero

**Evidencia:** `supabase/migrations/20260801040000_budgets_goals_recurring.sql` re-crea `budgets`, `goals` y `recurring_rules` — ya creadas en `010900`/`011000` — sin `DROP` ni `IF NOT EXISTS`, con esquemas incompatibles (`budgets` v1: `period`/`start_date`/`rollover` + hija `budget_lines`; v2: `category_id`/`amount_limit`) y nombres de policy colisionantes. `sync-config.ts:209-264` sincroniza contra la v2: la v1 es schema muerto. Cualquier deploy limpio (self-host, CI, staging) falla con `relation "budgets" already exists`; el proyecto remoto está en un estado que ninguna secuencia de migraciones reproduce.

Se agrava con **A11**: cero `GRANT` en las migraciones con `auto_expose_new_tables` desactivado (`config.toml:19-24` comentado = no expuesto). Hoy funciona porque las tablas se crearon antes del cambio de default; un proyecto nuevo da `permission denied for table accounts` a `authenticated` con RLS perfecto.

**Fix:** migración de reconciliación (`DROP TABLE budget_lines; DROP TABLE budgets/goals/recurring_rules CASCADE;` + recreate v2) — o, siendo un repo joven sin datos que conservar, reescribir `010900`/`011000`; más una migración de `GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated` (sin `DELETE`, coherente con soft-delete), `GRANT EXECUTE` explícito de las RPC, y `REVOKE ALL FROM anon`.

### C13 — Build de producción roto: `react-virtual` en `devDependencies`

**Evidencia:** `package.json:54` (bloque `devDependencies`) vs `src/app/(app)/transactions/page.tsx:5` (`import { useVirtualizer } from "@tanstack/react-virtual"`). Cualquier `pnpm install --prod` (el `Dockerfile` es el caso obvio) rompe con module not found. Revisar también `sharp`.

**Fix:** mover a `dependencies`.

### D1 — `<html lang="en">` en SSR para todos los locales

**Evidencia:** `src/app/layout.tsx:93-96` — el atributo dice `lang="en"`, el comentario dice que el fallback es `"es"`, y `sync-html-lang.tsx` solo corrige en `useEffect`. Tres fuentes desincronizadas. VoiceOver/NVDA leen el contenido en español con motor de voz inglés hasta hidratar (y para siempre si JS falla). WCAG 3.1.1 (A).

**Fix:** leer el locale en el server layout (`await getLocale()`) y renderizar `<html lang={locale}>`.

### D2 — `TransactionRow` no es un elemento interactivo

**Evidencia:** `src/design-system/finance/TransactionRow.tsx:54-66` — `div` con `onClick`, sin `role`, sin `tabIndex`, sin teclado. Es la fila principal de la app (movimientos, home, cuentas, búsqueda): cero navegación por teclado y cero anuncio como control. WCAG 2.1.1 + 4.1.2 (A). `ListRow.tsx:41-45` ya implementa el patrón correcto (`Tag = onClick ? "button" : "div"`).

**Fix:** replicar el patrón de `ListRow`.

### D3 — `Sheet` sin semántica de diálogo, focus trap, Escape ni restore

**Evidencia:** `src/design-system/core/Sheet.tsx:18-32` — sin `role="dialog"`, `aria-modal`, `aria-labelledby` (aunque pinta un `<h2>`), sin portal ni scroll lock; backdrop `div` con `onClick` inalcanzable por teclado. Lo usan **28 archivos** (filtros, FxEditor, categorías, captura, confirmaciones). `Overlay.tsx:32-68` implementa todo correctamente y solo lo usa la búsqueda. WCAG 2.1.2 + 4.1.2 (A).

**Fix:** hacer que `Sheet` reuse `Overlay` internamente.

### D4 — `--warning` como color de texto: 1,76:1 en modo claro

**Evidencia:** `NeedsFxBanner.tsx:31-45` y `Banner.tsx:24,45-52` usan `color: var(--warning)` (`#fab219`). Medido contra `--page` claro: **1,76:1** (AA exige 4,5:1). El banner de "faltan cotizaciones" y su botón "Resolver" — pieza central de la regla `needs_fx` — son casi invisibles en claro.

**Fix:** texto del banner en `--text-primary` con `--warning` solo en ícono/borde, o token `--warning-ink` oscurecido por modo.

---

## Hallazgos altos

### RLS y privilegios

### A5 — `WITH CHECK` de inmutabilidad tautológico en ~18 políticas

El idioma `household_id = (SELECT accounts.household_id)` dentro de un `WITH CHECK` no compara contra la fila vieja (no hay `OLD` en RLS): ambas referencias son la fila **nueva** → la expresión es siempre `TRUE`. Presente en `accounts.sql:57-60`, `transactions.sql:122-125,270,306`, `budgets_goals.sql`, `recurring_debts.sql`, `investments.sql`, `system.sql`, `fx_overrides.sql` y más.

**Impacto:** un usuario miembro de dos households puede reasignar cuentas, transacciones, presupuestos, deudas, trades y overrides entre ellos (la policy de SELECT también pasa en ese caso), y falsificar `created_by` en cualquier fila. El test pgTAP `10_accounts_rls.sql:61-68` pasa por la razón equivocada (lo rechaza la policy de SELECT, no el WITH CHECK).

**Fix:** trigger genérico `BEFORE UPDATE` (`IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN RAISE`) + reescribir el test para el caso miembro-de-dos-households.

### A13 — Un admin puede auto-promoverse a owner

`household_members_update` (`identity.sql:113-123` + fix de recursión `020400`) no restringe `role` ni `profile_id` (su `WITH CHECK` es la tautología de A5). Un `admin` puede `SET role='owner'` sobre sí mismo o degradar al owner real. **Fix:** trigger `BEFORE UPDATE` que solo un owner cambie roles a/desde `owner` y que impida degradar al último owner.

### A14 + E5 — `accept_invite` débil en tres frentes

`20260801050100_fix_duplicate_invites_table.sql:27-41`: (1) ignora `household_invites.email` — cualquiera con el código entra aunque la invitación fuera nominal; (2) `expires_at IS NULL` se acepta como "no vence" (la tabla `invites` descartada tenía `DEFAULT now() + 7 days`; se perdió al migrar); (3) el `CHECK` de `role` permite `'owner'` y la policy `FOR ALL` con `can_write` deja que un `member` no-admin cree invitaciones. **Fix:** validar email contra `auth.users` cuando no sea `NULL`; `expires_at NOT NULL DEFAULT now() + interval '7 days'`; `CHECK (role <> 'owner')`; separar la policy (insert solo admin).

### E4 — Códigos de invitación con `Math.random()`

`src/lib/repos/invites-repo.ts:15-20` — 8 caracteres de alfabeto de 32 símbolos con `Math.random()` (xorshift128+, estado recuperable). El código es la única credencial que consume `accept_invite` y otorga lectura completa de las finanzas del household. **Fix:** `crypto.getRandomValues` + 10-12 caracteres.

### A12 — Funciones `SECURITY DEFINER` ejecutables por `PUBLIC`

Las funciones están bien construidas (`SECURITY DEFINER` + `SET search_path = ''`, auditadas una por una), pero conservan el `EXECUTE` default a `PUBLIC`: `recompute_account_balance(uuid)` hace `UPDATE accounts` bypasseando RLS con cualquier `account_id` (UUID v7 parcialmente adivinable por timestamp), y `can_see_as()` es un oráculo de `visibility_grants` sin chequeo de membresía. **Fix:** `REVOKE EXECUTE … FROM PUBLIC, anon` en todas; `GRANT EXECUTE` a `authenticated` solo en las RPC reales (`accept_invite`, `mirror_*`).

### Cadena FX

### A6 — `transaction_splits` y `transaction_shares` sin `fx_source`

Desvío directo de `docs/01-arquitectura-datos.md` § 7 (que los declara resueltos). Solo tienen `amount_base`/`share_amount_base`; los triggers de herencia disparan sobre el hijo, pero **no hay trigger sobre `transactions` que propague hacia abajo**: cuando el padre resuelve su `pending`, los hijos quedan `NULL` para siempre y `settle-up` los excluye permanentemente. **Fix:** columnas + `CHECK` pareado + trigger `AFTER UPDATE ON transactions`.

### A7 — `inherited` puede tomar una cotización posterior a la fecha del movimiento

`src/lib/fx/resolve.ts:97` ordena por `asOf` descendente sin filtrar `asOf <= date`: un movimiento retroactivo (import CSV, gasto olvidado) hereda la cotización de **hoy**. En ARS, decenas de puntos de error. **Fix:** `candidates.filter(r => r.asOf <= date)` antes del sort; si queda vacío, `pending`.

### A8 — El override manual local ignora household y vigencia

`src/lib/repos/fx-repo.ts:50-54` toma el manual más recientemente fetcheado, sin `householdId` ni `valid_from`/`valid_to` — la tabla `fx_overrides` existe exactamente para eso y el camino remoto sí lo hace bien. Además `resolve` solo consulta `/api/fx` si el local dio `pending`: con cache local viejo, un movimiento de hoy queda `inherited` teniendo red. **Fix:** pasar `householdId` y `date`, filtrar vigencia; consultar `/api/fx` también cuando `source === 'inherited'` y la fecha es hoy.

### Sync y conflictos

### A10 — `sync_state` hardcodeado a `"ok"`

`sync-config.ts:200` escribe `sync_state: "ok"` en cada upsert; nadie escribe `'rejected'` ni `sync_error`; `'conflict'` solo se marca en Dexie local. La columna que existe para que D2 muestre "esto no se guardó" siempre vale `ok`. **Fix:** sacar `sync_state`/`sync_error` de `toRow`; propagar conflictos a Postgres.

### C12 — Conflictos y rechazos invisibles para el usuario

`TransactionRow.syncState` (`'rejected' | 'conflict'`) se escribe en `sync-worker.ts:81` y no se lee en ninguna pantalla; la única puerta a `/more/conflicts` es una fila sin badge en Más. Un movimiento en conflicto se ve idéntico a uno sincronizado. **Fix:** badge con contador en Más + `StatusBadge` en la fila + banner critical en home.

### C10 — `clientRev: 1` hardcodeado fuera de `transactions`

`accounts-repo.ts:76`, `categories-repo.ts:53`, `budgets-repo.ts:29`, `goals-repo.ts:29`, `recurring-rules-repo.ts:29`, `payees-repo.ts:32`, `tags-repo.ts:21`, `households-repo.ts:26`. El versionado optimista es ficticio: dos miembros editando la misma cuenta = último-que-sincroniza-gana en silencio, y `detectRevisionConflict` computa `baseRev = 0` que nunca matchea. **Fix:** llevar e incrementar `clientRev` en todas las filas sincronizables, como `transactions`.

### C11 — Upsert ciego: `conflictSensitive` solo en `transactions`

`sync-config.ts:166` — el límite de una tarjeta o el monto de un presupuesto editado por dos miembros se pisa sin aviso. **Fix:** extender `conflictSensitive` a toda tabla editable por más de un miembro (depende de C10).

### C8 — El outbox no garantiza FIFO

`outbox.ts:28` — `where("status").anyOf("pending","failed")` recorre el índice por valor: todas las `failed` primero. Un insert nuevo puede intentarse después de un update fallido que lo referencia → FK violation → ciclo de fallos permanente. **Fix:** `orderBy("id").filter(...)`, o cortar la cola al primer fallo por entidad.

### C9 — Sin backoff ni techo de reintentos

`use-sync-loop.ts:8,42` — reintento cada 30 s para siempre; `attempts` se incrementa pero nadie lo lee. Un error permanente (RLS 403 por B3, payload inválido) genera una request cada 30 s por entrada, por pestaña, indefinidamente. **Fix:** backoff exponencial con jitter (`nextAttemptAt`), techo → estado dead-letter visible.

### Onboarding y auth

### B6 — `completeOnboarding` no transaccional + el owner jamás sincroniza

`src/lib/onboarding/complete-onboarding.ts:35-95` — cinco `await` sueltos sin `db.transaction()` ni `try/catch`, con `setCurrentHouseholdId` en el paso 2: un fallo entre el 2 y el 5 deja un household activo sin cuenta ni member, estado irrecuperable desde la UI (el onboarding no vuelve a ofrecerse). Peor: `household_members` **no está en `SYNC_TABLES`** (`sync-worker.ts:41-47`) — el owner nunca llega al servidor y toda policy basada en membresía falla. **Fix:** transacción única con `setCurrentHouseholdId` al final; agregar `household_members` al sync o crear el household vía RPC transaccional.

### B7 — `/onboarding/success` duplica households y se cuelga ante errores

`success/page.tsx:24-58` — guard con `useRef` (solo cubre StrictMode): volver a la ruta re-ejecuta `completeOnboarding()` completo (segundo household, segunda cuenta). El IIFE async sin `try/catch` deja al usuario en el skeleton para siempre si algo falla. **Fix:** chequear `getCurrentHouseholdId()` antes de crear; estado de error con reintento.

### B10 — Reenvío de OTP sin cooldown

`verify/page.tsx:44-49,74-76` — botón sin `disabled`, sin contador: cada click dispara un correo. Mail-bombing de terceros y agotamiento de la cuota (el rate limit de Supabase ya se golpeó en pruebas según `docs/plan-de-trabajo.md:522`). **Fix:** cooldown de 60 s con contador + tope por sesión de verificación.

### UX de datos

### C6 — Ninguna mutación invalida `accounts`: saldos stale tras cargar un gasto

`CaptureFlow.tsx:46,96,112` y `EditTransactionFlow.tsx:78` solo invalidan `transactions`, pero `bumpBalance` sí muta `accounts.currentBalance` en Dexie. Con `staleTime: 30s` y `refetchOnWindowFocus: false`, home, detalle de cuenta, net-worth y budgets muestran el saldo previo indefinidamente. En una app de finanzas, cargar un gasto y ver el saldo igual es el peor bug de percepción. **Fix:** `invalidateAfterTransactionWrite()` central (`accounts`, `transactions`, `net-worth`, `budgets`, `debts`).

### C5 — `createOptimisticMutation` es código muerto

Cero llamadas en toda la app (solo el archivo, su export y un comentario). No hay rollback optimista en ningún lado; todas las escrituras son `await repo.x(); invalidate()`. Contradice la definición de "terminado" (§ 3). **Fix:** adoptarlo en las escrituras o borrarlo — decidir, no dejar la ilusión del patrón.

### C7 — No hay indicador offline real

`(app)/layout.tsx:117-118` mapea `pending > 0 → "offline"`: offline sin pendientes muestra "sincronizado" (mentira), online drenando muestra "offline" (mentira), y el estado `"syncing"` del componente nunca se usa. `OfflineBanner` se borró del design system sin reemplazo; ninguna pantalla tiene el estado offline que exige la definición de terminado. **Fix:** `useOnlineStatus()` (listeners `online`/`offline`) y mapear las tres señales reales.

### PIN

### B9 — `/search` y `/transactions/[id]/edit` fuera del `PinGate`

El gate está montado solo en `(app)/layout.tsx:106`. `/search` lista cuentas, payees y 20 transacciones con montos; `/transactions/[id]/edit` muestra el movimiento completo. La regla es "leer sí revela": el PIN se saltea navegando directo. **Fix:** mover `PinGate` a `Providers` con allowlist explícita de rutas pre-auth (`/add`, `/onboarding/*`, `/join`).

### C22 — El shortcut de captura evade el PIN mostrando saldos

`/add` fuera del gate es correcto (captura pre-auth), pero desde ahí `AccountPickerSheet` lista cuentas con nombre y saldo: el bloqueo se evade con un long-press en el ícono. **Fix:** mantener el keypad pre-auth pero ocultar saldos (o exigir PIN al abrir el selector de cuenta).

### B8 — El lockout de 30 s del PIN se evade con F5

`pin-store.ts:47,57` — `partialize` persiste solo `enabled` y `pinHash`; `failedAttempts`/`lockedUntil` viven en memoria y se resetean al recargar. La regla "3 errados = 30 s" queda anulada. **Fix:** incluirlos en `partialize`.

### Bundle

### C14 — Barrel completo de Phosphor en el Toaster global

`src/components/ui/sonner.tsx:4` importa de `@phosphor-icons/react` (>9.000 íconos referenciados) y el `<Toaster>` está en el árbol raíz. El resto del DS usa el subpath `dist/ssr` correcto. **Fix:** subpath o `optimizePackageImports`.

### C15 — Cero `next/dynamic` en toda la app

13 componentes de charts (Sankey, heatmap, waterfall…) y `motion/react` van en el bundle inicial aunque el usuario nunca abra Análisis. Contra el objetivo de captura < 5 s. **Fix:** `dynamic()` para `design-system/charts/*` y pantallas de módulos.

### C16 — Gate de módulos con `if` en render, prohibido y sin efecto

`budgets/page.tsx:28-31` y los otros cinco módulos: `useEffect` + `router.replace` + `return null`. Es exactamente el `if` en render que la regla prohíbe, produce un flash, y no ahorra un byte (el chunk ya se descargó, incluso con prefetch). **Fix:** `<ModuleGate>` declarativo en el layout + carga diferida real del contenido.

### A11y / i18n altos

### D5 — `--text-muted` no alcanza AA en ningún modo ni superficie

Medido: 2,95–3,92:1 según modo/superficie (AA exige 4,5:1 en texto chico). Se usa siempre en texto de 11-13 px: meta de `TransactionRow`, labels del TabBar, KPIs de `StatTile`, segmentos no elegidos. **Fix:** `--n-ink3-dark` ≈ `#8e8e96`, `--n-ink3-light` ≈ `#6b6b71` (≥4,5:1 contra `--surface-3`).

### D6 — El aqua de ingresos falla AA en modo claro

`--aqua-light: #12916a` da 3,42–3,97:1; es el único caso donde el color porta significado (polaridad). `--orange-light` igual (3,34–3,88). **Fix:** oscurecer a ≈ `#0d7a58` y ≈ `#b8451a`.

### D7 — `--critical` falla AA en modo oscuro

`#d03b3b` da 3,58:1 sobre `--surface-2` en el modo por defecto de la app; es el color de los mensajes de error de formulario a 12 px. **Fix:** tematizarlo por modo (≈ `#e8615f` en dark).

### D8 — `Input` no anuncia errores

`Input.tsx:19,45,53-64` — `invalid` solo pinta un borde; cero `aria-invalid`/`aria-describedby` en toda la app (grep). WCAG 3.3.1 + 4.1.2 (A). **Fix:** `useId()` + `aria-invalid` + `aria-describedby={hintId}` + `role="alert"` en el hint inválido.

### D9 — `OtpInput`: seis campos sin nombre accesible

`OtpInput.tsx:41-70` — sin `aria-label`, sin grupo, sin `aria-invalid`. Es el gate de verificación de cuenta: un usuario ciego no puede completar el alta. **Fix:** `aria-label` por casilla + `role="group"` + `aria-invalid` propagado.

### D10 — Fechas calculadas en UTC: los gastos nocturnos caen en el día siguiente

14 ocurrencias de `new Date().toISOString().slice(0, 10)` (`DetailsSheet.tsx:21,29,36`, calendarios de analytics, `resolve-fx`, `installment-schedule.ts`, `future-income.ts`, `api/fx/route.ts:26`…). Para un usuario en UTC−3, todo gasto cargado entre las 21:00 y las 00:00 se fecha **mañana**, cae en el período equivocado en los cortes de mes, y el snapshot de FX se pide para una fecha sin cotización. **Fix:** helper `todayIso(tz)` con `Intl.DateTimeFormat` y reemplazo de las 14 ocurrencias.

### D11 — Cero `<h1>` en las 70 pantallas de `(app)`

`AppHeader.tsx:66` renderiza el título como `<div>`. La navegación por encabezados — el atajo principal de lectores de pantalla — no funciona en toda la app autenticada. **Fix:** `AppHeader` renderiza `<h1>` con los mismos estilos.

### D12 — 8 charts SVG sin semántica ni toggle "ver como tabla"

Grep de `role=|aria-` sobre `charts/*.tsx`: una sola línea (y anuncia un ISO crudo). El toggle "ver como tabla" — regla explícita del design system — no existe; las series se distinguen solo por color. **Fix:** `role="img"` + `aria-label` resumen por SVG + toggle que conmute a `SeriesLegend layout="table"` con `<caption>`.

### D13 — El Keypad fija la coma decimal ignorando el locale

`Keypad.tsx:10` hardcodea `","`; existe `decimalSeparatorForLocale()` y `Amount` sí lo usa. `evaluateKeypadExpression` tiene default `es-UY` y **ningún caller le pasa locale**: un usuario `en` teclea `,` y ve `.` — y si el parser recibiera `en-US`, `"12,50"` se leería como 1250. **Fix:** tecla derivada del locale + callers pasan `numberLocaleForUiLocale(locale)`.

### D14 — Backspace y operadores del keypad sin nombre accesible

`KeypadKey.tsx:65` — botón cuyo único hijo es un ícono `aria-hidden`; se anuncia "botón" a secas en captura y en el desbloqueo por PIN. **Fix:** `aria-label` traducido resuelto por `Keypad`/`PinKeypad`.

---

## Hallazgos medios

### Seguridad y auth

- **B11 — Open redirect en `auth/callback`.** `route.ts:18,24` concatena `next` sin validar: `?next=@evil.com` produce `https://app.com@evil.com` (host = evil.com) tras un login exitoso. Fix: aceptar solo paths que empiecen con `/` y no con `//`.
- **B12 — PIN hasheado con SHA-256 sin sal ni estiramiento.** `pin-hash.ts:7-13` — 10⁶ candidatos se revierten en milisegundos desde un dump de localStorage, y el PIN suele reutilizarse con el del teléfono. Fix: PBKDF2-SHA256 con sal por dispositivo y ≥250k iteraciones.
- **B13 — El desbloqueo es un flag de sessionStorage falsificable.** `pin-gate.tsx:7,23-27` — inherente a un lock client-side; documentar el modelo de amenaza ("disuade miradas, no un atacante con DevTools") y no dejar que el PIN sea la única barrera sobre datos remotos.
- **B14 — La regla "60 s de edición sin desbloquear" no está implementada.** Hoy "funciona" porque `/transactions/[id]/edit` está fuera del gate (B9): al arreglar B9 se rompe. Fix: `lastSavedTxAt` en el store con excepción de 60 s para esa transacción.
- **B15 — El demo contamina la base real y envenena el outbox.** `seedDemoHousehold()` escribe en la misma DB con `DEMO_USER_ID` y encola todo: tras un login real quedan ~40 transacciones falsas mezcladas y una cola que falla por RLS para siempre. Fix: marcar `isDemo`, no encolar, borrar al primer login real.
- **B16 — Ningún input del onboarding pasa por Zod.** Email con regex ad-hoc, país/moneda del store persistido (localStorage editable) directo a `households.base_currency`. Fix: `onboardingDraftSchema` validado en `completeOnboarding()`, moneda restringida al catálogo.
- **B17 — Errores GoTrue crudos en inglés en toasts.** `toast.error(error.message)` en tres pantallas; contradice la política i18n. Fix: mapear `error.code` a claves `errors.*`.
- **B18 — `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` fuera del contrato de `env.ts`.** Única variable pública no declarada en `createEnv()` ni en `.env.example`; invisible para self-host. Fix: declararla opcional y documentarla.
- **E10 — `send-push` expone errores de Postgres al invocador** (`index.ts:49,73`): nombres de tabla, constraints. Fix: log interno + `{ error: "internal_error" }`.
- **E11 — `kind` sin validar en runtime**: la interfaz TS se borra; `kind: "constructor"` indexa el prototipo. Fix: Zod + `Object.hasOwn`.
- **E12 — `req.json()` sin try/catch ni guard de método**: GET o JSON inválido → 500 del runtime. Fix: `405` + `try/catch` → `400`.
- **E13 — Sin CORS ni handler de `OPTIONS`**: hoy la función es de facto server-to-server (bien defensivamente); documentarlo para que nadie lo "arregle" con `*`.
- **E14 — Detección de suscripciones muertas por substring `"410"`** en el error stringificado: falsos positivos borran suscripciones vivas, falsos negativos acumulan zombies. Fix: `reason.statusCode === 410 || 404`.
- **E15 — `otp_expiry = 3600` + password mínimo 6 sin composición** (`config.toml:234,182,185`): ~360 intentos/hora/IP sobre 10⁶ para el flujo principal de login. Fix: `otp_expiry = 600`, mínimo 8 con requisitos.
- **E16 — Sin captcha y `enable_confirmations = false`** con signup abierto: creación de cuentas a escala, cada una un JWT válido que habilita E1/E4. Fix: Turnstile/hCaptcha + confirmations en producción.

### PWA y datos

- **C18 — `skipWaiting: true` sin aviso de nueva versión** (`sw.ts:23-24`): el SW nuevo toma control de una pestaña con chunks viejos → `ChunkLoadError` en navegaciones lazy. Fix: `skipWaiting: false` + toast "Actualizar" que postee `SKIP_WAITING`.
- **C19 — Revisión del precache con `spawnSync("git")`** (`serwist/[path]/route.ts:7`): sin `.git` (Docker) cada instancia genera un `sw.js` distinto → reinstalación del SW en cada cold start; además bloquea el event loop. Fix: `VERCEL_GIT_COMMIT_SHA ?? APP_VERSION`.
- **C20 — El manifest depende de una cookie que no llega**: el fetch del manifest va sin credenciales; nombre del shortcut y `lang` nunca reflejan el idioma elegido, y el manifest queda dinámico. Fix: manifest estático.
- **C21 — `share_target` con GET**: no acepta imágenes → C10 (foto de ticket) sin puerta de entrada desde el SO. Fix: `share_target` POST a un route handler que persista y redirija a `/add`.
- **C24 — `Promise.all` en borrado masivo** (`transactions/page.tsx:145,150`): `bumpBalance` es read-modify-write en transacciones separadas → deltas perdidos en el saldo. Fix: secuencial o una sola transacción con delta agregado.
- **C26 — `navigationPreload: true` sin `NavigationRoute` que lo consuma**: la respuesta precargada se descarta (peor latencia). Verificar el warning en DevTools; desactivar o registrar la ruta.
- **C27 — Keys de query mezcladas (factories + strings sueltas) y sin `userId`**: invalidaciones frágiles y cache de TanStack que sobrevive a un cambio de usuario (agrava B4). Fix: `queryKeys` central tipado con `userId`/`householdId` como primer segmento.
- **C28 — Sin `gcTime` explícito**: default 5 min → flash de skeletons en cada retorno a la app aunque Dexie tenga los datos. Fix: `gcTime: 24h` + `placeholderData: keepPreviousData` en listas.
- **C29 — `refetchOnWindowFocus: false` global** también apaga el refresh de las queries que sí van a red (miembros, invitaciones, mirror). Fix: habilitarlo puntualmente en las remotas.
- **C30 — Listas sin virtualizar fuera de Movimientos**: categorías, tags, reglas, settle, merchants y `resolve-fx` (que puede listar cientos); otros cortan con `slice(0, 20)` que oculta datos. Fix: extraer `<VirtualList>` del patrón existente.
- **C31 — Dexie sin `versionchange`/`blocked`**: dos pestañas con versiones distintas de la DB → upgrade colgado sin mensaje. Fix: `db.on("versionchange", () => db.close())` + aviso en `blocked`.
- **C32 — `attempts`/`lastError` del outbox no llegan a ninguna pantalla**: imposible diagnosticar por qué algo no sincroniza. Fix: pantalla de diagnóstico en Más con reintento manual.
- **A15 — Soft-delete sin cascada y filtros inconsistentes**: borrar una cuenta no toca transacciones/snapshots/statements; cinco repos no filtran `deleted_at`; ninguna FK tiene `ON DELETE`. Fix: cascada explícita en `softDelete` + regla ESLint que exija `.is("deleted_at", null)`.
- **A16 — Rates de usuario vía `number`/`toFixed(12)`** (`currencies/page.tsx:125`, `FxEditor.tsx:113`): pérdida de precisión antes de `parseRate`. Fix: pasar el string crudo del input.
- **E9 — Cero crons: seis funcionalidades sin motor.** No hay `pg_cron`/`pg_net`, ni `vercel.json`, ni schedules: **(a)** nada escribe jamás en `fx_rates` — la tabla está vacía para siempre y las fechas pasadas nunca resuelven (el propio `api/fx/route.ts:15-21` lo declara pendiente como `BASE-02`); **(b)** las recurrentes nunca generan movimientos (`TransactionSource="recurring"` que nada llena — el usuario crea "Alquiler, día 5" y no pasa nada); **(c)** `send-push` está desplegada y muerta: los 4 toggles de notificaciones prometen envíos que jamás ocurren; **(d)** la purga de `audit_log` documentada no existe; **(e)** `insights` no tiene generador (tabla que nunca tendrá filas); **(f)** `card_statements` nunca transiciona a `overdue`. Fix: habilitar `pg_cron` + `pg_net` y programar mínimo el fetch diario de FX y el materializador de recurrentes.

### A11y / i18n medios

- **D15 — 17 botones de icono/volver de ~28×28 px** (back buttons artesanales con `padding: 4` en 13 pantallas, `PriceStatus`, `AmountStep`): el contrato exige 44×44 y `AppHeader` ya lo cumple. Fix: extraer `<IconButton>` de 44×44.
- **D16 — TabBar sin `aria-current`** y dos `<nav>` sin `aria-label` distinguible.
- **D17 — DateStrip sin `aria-pressed` ni label con fecha completa** ("M 24, botón" sin indicar selección; `formatDateLong` existe y no se usa acá).
- **D18 — Banner de error con `role="status"`** (polite) en vez de `role="alert"`.
- **D19 — `ProgressBar`/`BudgetRing`/`SplitBar` sin `role="progressbar"`** ni `aria-valuenow/valuetext`: presupuestos y metas puramente visuales.
- **D20 — Búsqueda sin patrón combobox**: input solo con placeholder, `activeIndex` sin `aria-activedescendant`, sin live region de conteo.
- **D21 — Sin skip link a `<main>`**: con Sidebar en desktop, tab por toda la navegación en cada página. WCAG 2.4.1 (A).
- **D22 — `Modal` de la ruta interceptada `/add` sin semántica ni foco**: el flujo central del producto sin `role="dialog"`, Escape ni trap.
- **D23 — Copy PT con errores reales (no cognados)**: `capture.kind.expense` = "Gasto" → **"Despesa"** (ídem `transactions.list.expenses`, `splitPage.title`), `morePage.settings` = "Ajustes" → **"Configurações"**, `common.seeAll` → **"Ver tudo"**, e inconsistencia interna movimento/movimentação. ~8 claves; revisión por hablante nativo.
- **D24 — Placeholders con formato numérico argentino en los tres idiomas** (`placeholder="150,00"` para un usuario `en`). Fix: derivarlos con `formatNumber(…, {locale})`.

---

## Hallazgos bajos

- **A17** — `countries.code` en `char(2)` (consistencia con la regla de monedas; el doc lo prescribe así, pero `char` padea con espacios).
- **A18** — Índices faltantes en FKs consultadas: `transactions.counter_account_id` (el `OR` de `recompute_account_balance` fuerza scan), `household_invites.household_id`, `visibility_grants.granted_by`, `categories.parent_id`, entre otros.
- **A19** — `docs/01-arquitectura-datos.md` desincronizado del schema real (las migraciones `040000`–`080000` definen tablas que el doc no tiene; y el doc afirma resuelto el `fx_source` de splits/shares, que no lo está — ver A6).
- **A20** — `households` sin flujo de baja; `current_households()` no filtra `deleted_at`, así que un household "borrado" a mano seguiría dando acceso.
- **B19** — Doble `verifyOtp` posible por paste en la misma vuelta de eventos (el segundo consume un OTP quemado → falso "código inválido"). Fix: guard `if (verifying) return`.
- **B20** — `/onboarding/verify` con email vacío si se entra directo por URL: falla con "invalid code" en vez de redirigir a A2.
- **B21** — Falta el estado offline **aprobado** de A3 ("el email quedó guardado y se manda al volver la señal" + "Probar de nuevo"): hoy solo hay un toast con el error crudo de fetch. La rama descartada ("Empezar sin conexión") correctamente no está.
- **B22** — Aserciones `!` en `country/page.tsx:15,37`: un `countryCode` corrupto en localStorage crashea la página. Fix: fallback en el `find`.
- **B23** — `GEMINI_API_KEY` residual en `.env.local` sin referencia en `src/` (gitignoreada, sin `NEXT_PUBLIC_`; se elimina junto con E3).
- **C33** — El push handler referencia `/icon.svg` que Next sirve versionado; usar `/icons/icon-192.png` de `public/`.
- **C34** — Sin `headers()` en `next.config.ts`: falta `Cache-Control: no-store` para `/api/*` y CSP.
- **E17** — Los montos van en texto plano al lockscreen sin preferencia "ocultar montos en notificaciones" — evade el propósito del PIN.
- **E18** — `Notification.requestPermission()` sin fallback cuando ya está `denied`: el usuario ve un error genérico sin saber que debe ir a los ajustes del navegador.
- **E19** — La "notificación persistente de captura rápida" (Android) especificada en `docs/00-producto.md` no existe: falta una de las cuatro entradas de captura.
- **E20** — `push_subscriptions` sin tope por perfil, sin `updated_at` ni caducidad de filas inactivas.
- **D25** — `Amount` con `privacy` solo aplica blur visual: el monto sigue en el árbol de accesibilidad y se lee en voz alta (`PrivacyBlur` sí lo hace bien con `aria-hidden`).
- **D26** — `CalendarHeatmap` anuncia la fecha ISO cruda ("dos mil veintiséis guion…"); usar `formatDateLong` + el valor de la celda.
- **D27** — `outline: "none"` inline en `Input`, `OtpInput` y búsqueda pisa el `:focus-visible` global (especificidad 0 del `:where()`); verificar que el anillo de foco se pinte.
- **D28** — Disabled a `opacity: 0.4` sobre colores ya al límite: invisibles. Cosmético.
- **D29** — `ZMark` con `aria-label="PERZE"` hardcodeado (única cadena fuera del catálogo; `app.name` ya existe).
- **D30** — `family/activity/page.tsx:56` llama `toLocaleDateString()` sin locale, cayendo al del navegador en vez del elegido.

---

## Lo que está bien

Registrado para que ningún fix lo rompa; varios auditores lo verificaron de forma independiente.

**Datos y schema:** dinero en `bigint`, cantidades `numeric(38,12)`, rates `numeric(24,12)` consistentes; `formatAmount` opera bigint puro sin `Number()`; `formatNumber` exige `decimals` sin default (contrato cumplido); los agregados de `analytics/` (period-summary, budget-progress, money-flow, balances, currency-exposure, portfolio-return, settle-up…) **excluyen `amountBase === null` y reportan el conteo excluido**; IDs UUID v7 generados en cliente; la tabla `invites` duplicada fue eliminada; `auth.uid()` envuelto en `(SELECT auth.uid())` en las 40+ apariciones; herencia RLS por `EXISTS` sin `household_id` duplicado; todas las funciones helper con `SECURITY DEFINER` + `SET search_path = ''` sin excepción; `audit_log` append-only real; Patrón C bien aplicado en `fx_rates`/`price_index`/`benchmarks`.

**Auth:** `@supabase/ssr` correctamente separado (browser/server), sesión en cookies — cero tokens en localStorage; siempre `getUser()` (cero `getSession()` en el repo); `proxy.ts` con nombre y export correctos para Next 16 y patrón `getAll`/`setAll` moderno; trigger `handle_new_user` correcto; policies de INSERT de household con `WITH CHECK` real; sin user enumeration (registro y login indistinguibles); los botones OAuth ausentes —no deshabilitados— sin configuración, como manda la decisión cerrada; la rama descartada "Empezar sin conexión" correctamente no implementada.

**Server:** el payload de push va cifrado `aes128gcm` — FCM/Mozilla no pueden leer los datos financieros; `service_role` contenido en su único uso legítimo (Edge Function); RLS de `push_subscriptions` y `notification_preferences` correcto con `USING` + `WITH CHECK`; `.env.local` nunca commiteado (el problema es Docker, no git); el permiso de push se pide en el toggle explícito, nunca al cargar.

**i18n y a11y:** paridad perfecta de 905 claves en ES/EN/PT con test que la enforcea; plurales ICU correctos incluido `=0`; `react/jsx-no-literals` activo con **cero** strings hardcodeadas en `src/app` + `src/features` + `src/design-system`; el contrato `aria-live` de `Keypad`/`PinKeypad` implementado exactamente como pide el contrato (monto sí, dígitos del PIN jamás); `Overlay.tsx` es un diálogo modelo (portal, trap bidireccional, Escape, restore, scroll lock); polaridad del dinero cumple (aqua + tinta neutra + signo + flecha + posición, nunca verde/rojo); `prefers-reduced-motion` en dos capas más el ajuste propio de intensidad, con la política correcta (el SO nunca se pisa hacia arriba); `SegmentedControl`, `Switch`, `AppHeader`, `TabBar` y `ListRow` con ARIA correcto y comentado.

---

## Plan de resolución por fases

Ordenado por criticidad. Cada fase es autocontenida y sigue la regla del proyecto: un bloque, una rama, un PR (F0 es la excepción: acciones manuales + un commit trivial).

### F0 — Hoy mismo (sin apenas código)

| Acción | Hallazgos |
|---|---|
| Rotar `SUPABASE_ACCESS_TOKEN` (panel de cuenta Supabase), regenerar par VAPID (y actualizar el secret de la Edge Function + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`), rotar/eliminar `GEMINI_API_KEY` | E3, B23 |
| Crear `.dockerignore` (`.env*`, `.git`, `node_modules`, `.next`) | E3 |
| Sacar `SUPABASE_ACCESS_TOKEN` y `VAPID_PRIVATE_KEY` de `.env.local` | E3 |
| Mover `@tanstack/react-virtual` (y revisar `sharp`) a `dependencies` | C13 |

**Hecho cuando:** las claves viejas están revocadas, `docker build` no contiene secretos (verificable con `docker history`), `pnpm install --prod && pnpm build` pasa.

### F1 — Detener la corrupción de datos

**Hallazgos:** A1, A3, A4, C3, C4, D10. **Archivos:** `src/lib/offline/sync-config.ts`, `src/features/capture/save-transaction.ts`, `src/features/movements/update-transaction.ts`, `src/lib/offline/{outbox,sync-worker}.ts`, `src/lib/repos/*.ts` (transacción + enqueue), nuevo `src/lib/dates/today.ts`.

1. Serializar rates con `formatRate()` en el outbox + test de round-trip (A1).
2. Captura sin rate: persistir `original_*` con lo tipeado, nunca reinterpretar (A3).
3. Congelar `fx` en edición; crear `resolvePendingFx(txId)` con recálculo de hijos (A4).
4. Reset de entradas `syncing` al arrancar el drain (C3); enqueue dentro de la transacción Dexie en todos los repos (C4).
5. `todayIso(tz)` y reemplazo de las 14 ocurrencias UTC (D10).
6. **Saneo del remoto** (ver sección siguiente).

**Hecho cuando:** round-trip de rates verde; e2e de captura en moneda extranjera sin cotización deja `pending` con `original_*`; editar la nota de un movimiento viejo no toca `fx_rate`; test de drenaje con interrupción no pierde entradas; un gasto a las 23:00 UTC−3 queda fechado hoy.

### F2 — Identidad y sesión

**Hallazgos:** B1/B2, B3, B4 (+E7, C17-purga), B8, B9, B12, B14, C22. **Archivos:** `src/proxy.ts`, `src/hooks/use-current-user.ts`, `src/lib/db/client.ts`, nuevo `src/lib/auth/sign-out.ts`, `src/components/{pin-gate,providers}.tsx`, `src/stores/pin-store.ts`, `src/lib/security/pin-hash.ts`.

1. Gate real en `proxy.ts` con allowlist de rutas públicas (B1).
2. `useCurrentUserId()` tri-estado; escrituras bloqueadas sin uid real (B3).
3. `signOut()` completo: Supabase + `db.delete()` + stores + caches del SW + `unsubscribeFromPush()`; Dexie namespaced `perze-${userId}` (B4/E7).
4. `PinGate` en `Providers` con allowlist pre-auth; regla de 60 s implementada de verdad; saldos ocultos en el picker pre-desbloqueo (B9/B14/C22).
5. Lockout persistido en `partialize`; PBKDF2 con sal (B8/B12), con migración del hash existente.

**Hecho cuando:** e2e de sesión vencida → redirect; e2e de logout → Dexie vacía y caches purgadas; navegar a `/search` bloqueado pide PIN; F5 no resetea el lockout.

### F3 — Superficie server

**Hallazgos:** B5 (+C25), E1, E2, E4, E5/A14, E10-E13, E15, E16, B11. **Archivos:** `src/app/api/fx/route.ts`, `src/lib/fx/providers/*.ts`, `src/app/sw.ts`, `supabase/functions/send-push/index.ts`, `supabase/config.toml`, `src/lib/repos/invites-repo.ts`, migración nueva de invites, `src/app/auth/callback/route.ts`.

1. `/api/fx`: auth + Zod + `encodeURIComponent` + `no-store`; `NetworkOnly` en el SW antes de `defaultCache`; respetar `asOf` al sellar cache local (B5/C25).
2. `send-push`: authz por membership, validación del body, `url` relativa, errores opacos, guard de método; `openWindow` con chequeo de origin en el SW; `[functions.send-push] verify_jwt = true` (E1/E2/E10-E13).
3. Invitaciones: `crypto.getRandomValues` + 10-12 chars; migración con email nominal validado en `accept_invite`, `expires_at NOT NULL DEFAULT +7 days`, `CHECK (role <> 'owner')`, insert solo admin (E4/E5/A14).
4. `config.toml`: `otp_expiry = 600`, password 8 + composición, captcha y confirmations para producción (E15/E16).
5. Callback: `next` validado como path relativo (B11).

**Hecho cuando:** `/api/fx` sin sesión devuelve 401 y con `date` malicioso devuelve 400; `send-push` con anon key sin membership devuelve 403; un código de invitación expira a los 7 días.

### F4 — Schema reproducible y RLS

**Hallazgos:** A2, A11, A12, A5, A13, A6. **Archivos:** migraciones nuevas (append-only), `supabase/tests/database/*.sql`.

1. Migración de reconciliación de `budgets`/`goals`/`recurring_rules` (A2).
2. Migración de `GRANT`s + `REVOKE EXECUTE … FROM PUBLIC, anon` en las SECURITY DEFINER (A11/A12).
3. Triggers de inmutabilidad de `household_id`/`created_by` reemplazando los `WITH CHECK` tautológicos; protección del rol owner (A5/A13).
4. `fx_source` + `CHECK` pareado en `transaction_splits`/`transaction_shares` + trigger de propagación desde el padre (A6).
5. pgTAP nuevo: caso miembro-de-dos-households; ejecutar la cadena completa de migraciones contra un schema limpio en CI.

**Hecho cuando:** la cadena de migraciones aplica desde cero en un proyecto vacío; el pgTAP del doble household falla antes del fix y pasa después.

### F5 — Sync confiable y visible

**Hallazgos:** A7, A8, A10, C5, C6, C7, C8, C9, C10, C11, C12, C32, B6, B7, B10, C24. **Archivos:** `src/lib/fx/{resolve,…}.ts`, `src/lib/repos/fx-repo.ts`, `src/lib/offline/*`, `src/lib/repos/*` (clientRev), hooks de invalidación, `(app)/layout.tsx`, `complete-onboarding.ts`, `success/page.tsx`, `verify/page.tsx`, pantalla de diagnóstico en Más.

1. Cadena FX correcta: `asOf <= date`, override por household y vigencia, refresh de `inherited` con red (A7/A8).
2. `clientRev` real en todos los repos → `conflictSensitive` ampliado → `sync_state` honesto en Postgres → conflictos visibles (badge + `StatusBadge` + banner) (C10 → C11 → A10 → C12).
3. Outbox: FIFO por `id`, backoff exponencial con dead-letter, pantalla de diagnóstico (C8/C9/C32).
4. `invalidateAfterTransactionWrite()` central; decisión sobre `createOptimisticMutation` — adoptar o borrar (C6/C5).
5. `useOnlineStatus()` y las tres señales reales del SyncDot (C7).
6. Onboarding transaccional + `household_members` en `SYNC_TABLES` + success idempotente con estado de error; cooldown de OTP (B6/B7/B10).
7. Borrado masivo secuencial (C24).

**Hecho cuando:** cargar un gasto actualiza el saldo al instante; un conflicto simulado se ve en la fila y en Más; dos miembros editando la misma cuenta no se pisan en silencio; el onboarding interrumpido a mitad se recupera.

### F6 — Motores faltantes (cron)

**Hallazgos:** E9 completo, E14, E20. Habilitar `pg_cron` + `pg_net` (migración); cron diario de FX que escribe `fx_rates`; materializador de recurrentes (genera transacciones con `source='recurring'`); disparadores de los 4 tipos de notificación hacia `send-push`; purga de `audit_log`; transición de `card_statements` a `overdue`; limpieza de suscripciones por `statusCode` real + caducidad.

**Hecho cuando:** `fx_rates` tiene filas de hoy sin intervención manual; una recurrente de prueba genera su movimiento; una notificación de presupuesto llega end-to-end.

### F7 — Accesibilidad e i18n

**Hallazgos:** D1, D2, D3, D4-D7 (tokens), D8, D9, D11-D24, D25-D30, B17, B22, D-otros. Orden interno recomendado por impacto/esfuerzo: D3 (Sheet → Overlay, ya está escrito) → D2 (patrón de ListRow) → D1 (lang en server) → D4-D7 (cuatro tokens, un commit, con tests de contraste en `globals-tokens.test.ts`) → D8/D9 (ARIA de formularios) → D10 ya resuelto en F1 → D11 (h1 en AppHeader) → D13/D14 (keypad por locale) → D12 (charts + toggle tabla) → D15 (`IconButton`) → resto de medios y bajos → copy PT (D23) con revisión nativa.

**Hecho cuando:** axe sin violaciones nivel A en home, movimientos, captura y onboarding; los cuatro tokens pasan el test de contraste ≥ 4,5:1; navegación completa por teclado del flujo de captura.

### F8 — Fluidez y bundle

**Hallazgos:** C14, C15, C16, C18, C19, C20, C21, C26, C27, C28, C29, C30, C31, B15, B16, B18, C33, C34, A15, A16. Phosphor por subpath; `next/dynamic` de charts y módulos + `<ModuleGate>` declarativo; flujo de actualización del SW con toast; revisión estable del precache; manifest estático; `share_target` POST; `queryKeys` central con usuario + `gcTime` + focus selectivo; `<VirtualList>`; Dexie `versionchange`; demo aislado y purgable; Zod en onboarding; `headers()` con `no-store` y CSP.

**Hecho cuando:** el bundle inicial no contiene charts ni el barrel de Phosphor (verificar con `next build` + analyze); apagar un módulo no descarga su código; el deploy nuevo muestra el toast de actualización en vez de romper chunks.

### F9 — Deuda menor

Los bajos restantes: A17, A18, A19 (re-sincronizar `docs/01` con el schema real), A20, B19, B20, B21, D28, D29, E17, E18, E19 (notificación persistente de captura — evaluarla como feature, no como fix).

### Dependencias entre fases

- **B14 ← B9**: la regla de 60 s debe implementarse en el mismo PR que cierra el gate, o la edición post-captura se rompe.
- **C11 ← C10**: `conflictSensitive` sin `clientRev` real detecta conflictos falsos.
- **Saneo ← A1**: limpiar los rates ×10¹² del remoto recién después de desplegar el fix de serialización, o se re-corrompen.
- **F5 (FX) ← F1**: la cadena de resolución corregida asume que la captura ya no inventa rates.
- **E16 (captcha) ← B10**: activar captcha sin el cooldown de OTP empeora la UX del reenvío.
- **D12 (toggle tabla) ← C15**: si los charts pasan a `dynamic()`, el toggle entra en el mismo refactor.

---

## Datos ya dañados en el remoto

El fix de código no alcanza: hay que sanear lo que ya se escribió. Ejecutar **después** de desplegar F1, con `service_role` desde un script puntual (nunca desde el cliente).

### Rates ×10¹² (A1)

```sql
-- Diagnóstico: ningún rate legítimo supera 10^6
SELECT id, fx_rate, original_rate, counter_fx_rate
FROM transactions
WHERE fx_rate > 1000000 OR original_rate > 1000000 OR counter_fx_rate > 1000000;
```

Corrección: dividir por `10^12` **solo** las filas detectadas (el valor escalado es exacto, la división es segura en `numeric`). Nota: esto es saneo de un valor corrupto, no un recálculo — no viola la regla de congelamiento, que aplica a rates legítimos.

### Escrituras con el usuario demo (B3)

```sql
SELECT count(*) FROM transactions WHERE created_by = '018f2f7a-0000-7000-8000-000000000001';
SELECT count(*) FROM households WHERE created_by = '018f2f7a-0000-7000-8000-000000000001';
```

Si RLS funcionó, no debería haber filas en el remoto (fueron rechazadas) — el daño real está en los **outbox locales** de cada dispositivo: entradas con owner demo que reintentan para siempre. El `signOut()`/migración de F2 debe detectarlas y descartarlas o reasignarlas al uid real.

### Households duplicados o incompletos (B6/B7)

```sql
-- Households sin member owner (B6: household_members nunca sincronizó)
SELECT h.id FROM households h
LEFT JOIN household_members m ON m.household_id = h.id AND m.role = 'owner'
WHERE m.household_id IS NULL;

-- Posibles duplicados del mismo creador (B7)
SELECT created_by, count(*) FROM households GROUP BY created_by HAVING count(*) > 1;
```

### Estado v1/v2 de budgets/goals/recurring (A2)

Verificar qué versión de las tres tablas existe realmente en el remoto (`\d budgets`) antes de escribir la migración de reconciliación: el remoto puede tener la v1, la v2, o una mezcla según el orden en que se aplicaron los pushes.

---

## Verificación por fase

| Fase | Verificación |
|---|---|
| F0 | Claves viejas revocadas; `docker history` limpio; `pnpm install --prod && pnpm build` verde |
| F1 | Test round-trip `parseRate(formatRate(r))`; e2e captura sin cotización → `pending` con `original_*`; test de drenaje con interrupción; test de `todayIso` con TZ |
| F2 | e2e sesión vencida → redirect; e2e logout → Dexie/caches vacíos; e2e PIN cubre `/search`; lockout sobrevive a F5 |
| F3 | Tests de 401/400/403 de `/api/fx` y `send-push`; test de expiración de invitación |
| F4 | Cadena de migraciones desde cero en CI; pgTAP miembro-de-dos-households; pgTAP de escalada de rol |
| F5 | e2e "cargo gasto → saldo cambia"; e2e conflicto visible; test FIFO y backoff del outbox; e2e onboarding interrumpido |
| F6 | `fx_rates` con filas del día; recurrente genera movimiento; notificación end-to-end |
| F7 | axe nivel A limpio en pantallas core; tests de contraste de tokens; e2e teclado del flujo de captura |
| F8 | Bundle analyze sin charts/barrel en el chunk inicial; e2e actualización del SW |
| Global | `pnpm lint` y `pnpm build` limpios en cada PR; `pnpm test` y `pnpm e2e` verdes |
