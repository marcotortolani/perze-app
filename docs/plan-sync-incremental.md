# Plan: sincronización incremental (AC-14)

> Diseño, no implementación — pedido el 2026-08-02 al cerrar la auditoría de
> acceso (`docs/auditoria-acceso.md`). Objetivo: que los cambios hechos en el
> dispositivo A lleguen al dispositivo B sin restauración manual — el
> multi-dispositivo *simultáneo* que la hidratación de v0.8.0 no cubre.

## Punto de partida (v0.8.x)

- **Push**: outbox de Dexie → Supabase (`sync-worker.ts`), cada 30 s y al
  volver la conexión. Corregido en v0.8.1 (AC-17): hoy funciona.
- **Pull**: solo la hidratación one-shot (`hydrate.ts`) al entrar en un
  dispositivo sin datos. Después de eso, B nunca vuelve a mirar el servidor.
- Restricción verificada: `tags` y `payees` **no tienen `updated_at`** en
  Postgres; el resto de las tablas sincronizadas sí. No existe ningún índice
  sobre `updated_at` (sería seq scan).

## Diseño

### 1. Incremental solo donde importa

`transactions` es la única tabla sin cota de tamaño — la única que justifica
un cursor. El resto (households, members, accounts, categories, tags, payees,
budgets, goals, recurring_rules, rules) son decenas-a-cientos de filas: se
refrescan **completas** en cada ciclo de pull, reusando los mappers puros de
`hydrate.ts` (`accountFromRow`, `categoryFromRow`, etc., todos exportados).
Esto evita además el problema de `tags`/`payees` sin `updated_at`.

Lo que **no** se reusa tal cual es el fetcher: `fetchPaged` está declarado
`async function` sin `export` dentro de `hydrate.ts` (línea 525), y las listas
de columnas de cada `select` viven inline en `hydrateFromRemote` en vez de en
constantes. F1 arranca con una extracción mecánica de `PAGE_SIZE`,
`fetchPaged` y esas listas de columnas a un módulo compartido — sin eso no
hay de dónde importar para el pull. `hydrateFromRemote` en sí no sirve como
base: tiene un guard de no-clobber que corta si ya hay households locales.

El refresh completo **no** mantiene `accounts.current_balance` fresco sin
matices. `accountsRepo.applyBalanceDelta` escribe el saldo local sin encolar
nada en el outbox — a propósito, porque lo recalcula un trigger de Postgres a
partir de las transactions ya sincronizadas. Si el refresh de `accounts`
pisara `currentBalance` mientras esa transaction todavía no volvió del push,
el saldo saltaría hacia atrás en pantalla y se corregiría recién en el tick
siguiente: el flash que la app no puede permitirse. La regla exacta queda en
la § 5, junto con el resto del merge.

El refresh completo también es la ocasión de podar. `hydrate.ts` escribe con
`bulkPut`, que nunca borra: para las tablas donde el push hace un DELETE real
en vez de soft-delete (`household_members`, `tags`, `payees`, `budgets`,
`goals`, `recurring_rules` — las seis con `deletedAtColumn: ""` en
`sync-config.ts`), una fila borrada en A desaparece del servidor pero sigue
viva para siempre en B si nadie la elimina localmente. El pull incremental
tiene que borrar, después de cada refresh completo, todo `id` local que no
vino en la respuesta — con la misma excepción de outbox que protege al resto
del merge (§ 5).

### 2. Migración (append-only)

```sql
-- Cursor del pull incremental de transactions — parcial: las soft-deleted
-- igual deben viajar (el delete de A tiene que llegar a B), así que SIN
-- filtro de deleted_at. Verificado: la policy tx_select ya no filtra por
-- deleted_at desde 20260801020000_fix_soft_delete_rls.sql, así que RLS no
-- bloquea el pull de una fila borrada.
-- La tercera columna es para paginar por keyset (§ 4), no por offset.
CREATE INDEX transactions_household_updated_idx
  ON public.transactions (household_id, updated_at, id);
```

Nada más: no hace falta `updated_at` en `tags`/`payees` (van por refresh
completo) ni triggers nuevos (`updated_at` ya se escribe en cada UPDATE desde
los repos y `sync-config.ts` lo sube).

### 3. Watermark

`meta` de Dexie: `pullWatermark:<householdId>` = el `max(updated_at)` de la
última página bajada, **menos 5 segundos de solape** (clock skew entre
escritores; las filas re-bajadas por el solape son idempotentes vía
`bulkPut`). El watermark se escribe en la misma transacción Dexie que las
filas — nunca un cursor que apunte más allá de lo persistido.

### 4. El ciclo

En el mismo tick de `use-sync-loop.ts` (30 s / evento `online`), **siempre
push antes que pull**:

1. `drainOutbox()` — lo local pendiente sube primero.
2. Pull incremental de `transactions`: `updated_at > watermark`, orden
   `(updated_at, id)`, paginado por **keyset** (siguiente página parte de la
   última fila bajada), no por offset — con filas entrando durante la
   paginación, `.range(from, to)` puede saltear una fila que se corrió de
   página entre dos requests.
3. Refresh completo de las tablas chicas, con la poda de la § 1.
4. Invalidar las query keys afectadas.

El tick de `use-sync-loop.ts` hoy solo hace algo si `outbox.count() > 0`
(línea 36): el pull tiene que quedar **fuera** de ese `if`, porque el
dispositivo que solo lee —el caso de uso completo de este documento— tiene
el outbox vacío por definición. Dejarlo adentro deja el pull sin correr
nunca en B, en silencio.

### 5. Regla de merge (la única decisión delicada)

Por fila bajada: **si existe cualquier fila en `outbox` con ese `entityId`,
la fila local NO se pisa** — la versión local está en camino al servidor; el
push la consolida (o la deja en `dead`/`conflict`) y el próximo pull la trae
de vuelta ya resuelta. Es una consulta sobre el índice `entityId` que la
tabla `outbox` ya tiene (`client.ts`, versión 1), sin distinguir estados: da
igual si la entrada es `pending`, `failed`, `dead` o `conflict` — todas
significan "no hay una versión del servidor que sea más nueva que esta
todavía". (`listPending()` sí filtra por estado, pero es del lado del push,
no de este merge; no hay que confundirlos.)

Caso aparte: una entrada en `conflict` no se drena nunca sola, así que bajo
esta regla bloquea el pull de esa fila hasta que el usuario la resuelva desde
la pantalla de conflictos (`conflicts-repo.ts`). Es el comportamiento
correcto — mostrar la versión del servidor por encima de un conflicto no
resuelto sería perder silenciosamente la edición local — pero quedaba
implícito y hay que dejarlo escrito así el primero que lo programe no elige
al azar.

Sin ninguna entrada de outbox, `bulkPut` y el servidor gana (su `client_rev`
es la última escritura consolidada; el conflicto de ediciones simultáneas ya
lo detecta el push por `client_rev`, no hace falta duplicarlo acá). Los
soft-delete viajan como filas con `deleted_at` — mismo camino, sin casos
especiales.

**Excepción de `accounts.current_balance`**: mientras el outbox tenga
cualquier entrada de tabla `transactions`, el refresh de `accounts` no
escribe `currentBalance` (sí el resto de las columnas). El saldo depende de
transactions que todavía pueden no haber vuelto del push; pisarlo antes
produce el salto hacia atrás que describe la § 1.

### 6. Realtime (fase posterior, opcional)

Suscripción `postgres_changes` por household para latencia sub-segundo, con
el pull incremental quedando como red de seguridad (reconexiones, mensajes
perdidos). Exige habilitar la publication y revisar que RLS filtre los
eventos. No entra en la primera implementación: el pull de 30 s ya da un
multi-dispositivo utilizable.

## Riesgos conocidos

- **`transactions` que salen del alcance de `can_see`** (visibilidad cambiada
  por otro miembro): el pull incremental no trae un "ya no podés ver esto",
  así que la copia local queda zombie hasta la próxima hidratación completa.
  Para las tablas chicas este riesgo ya no existe — la poda por diff de ids de
  la § 1 lo resuelve en cada ciclo, sea por visibilidad o por delete real.
  Queda abierto solo para `transactions`, porque ahí el pull es incremental y
  nunca ve el conjunto completo para comparar. Mitigación si molesta en la
  práctica: comparar contra una hidratación completa periódica, o resolverlo
  cuando entre Realtime (§ 6), que sí puede notificar la baja de acceso.
- **Reloj del servidor vs. `updated_at` escrito por el cliente**: los repos
  escriben `updatedAt` con la hora del dispositivo (`nowIso()` en
  `lib/repos/ids.ts`), y no hay trigger de Postgres que lo pise — se
  confirmó que ningún trigger existente toca `updated_at` salvo un `UPDATE`
  explícito de un job de cron ajeno a este flujo. Un dispositivo con reloj
  atrasado produce filas "viejas" que otro peer podría saltear pese al
  solape. Mitigación de fondo (si aparece): trigger server-side que pise
  `updated_at` con `now()` en cada write — decisión aparte porque cambia qué
  significa la columna para el resto del código.
- **Los hijos de una transaction no viajan.** `hydrate.ts` baja once tablas y
  ninguna es `transaction_splits`, `transaction_shares`, `transaction_tags`
  ni `settlements` — no lo introduce este plan, lo hereda de la hidratación
  actual. Consecuencia concreta: un gasto dividido cargado en A llega a B
  como transacción entera, y J7 (quién le debe a quién) puede mostrar un
  número equivocado hasta la próxima hidratación completa. Queda fuera de
  F1 por alcance, pero entra como candidato natural para F1 si aparece antes
  de programarlo (mismo cursor del padre, filtrando por `transaction_id in
  (…)` de la página bajada) o, si no, tiene que quedar declarado como límite
  conocido en vez de sorpresa.

## Fases y tamaño

| Fase | Contenido | Tamaño |
|------|-----------|--------|
| F1 | Extraer `PAGE_SIZE`/`fetchPaged`/columnas de `hydrate.ts` a un módulo compartido + migración del índice + `pull.ts` (cursor keyset, merge por outbox, excepción de `currentBalance`, poda de tablas chicas) + tests unitarios del merge, la poda y la excepción de saldo | 1 sesión larga |
| F2 | Cableado al tick del sync-loop (pull fuera del `if (pending > 0)`) + invalidaciones + e2e de dos contextos (A escribe, B ve) | media sesión |
| F3 | Realtime opcional | sesión aparte |
