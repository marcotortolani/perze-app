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
refrescan **completas** en cada ciclo de pull, reusando los fetchers y mappers
de `hydrate.ts` tal cual. Esto evita además el problema de `tags`/`payees` sin
`updated_at`, y mantiene `accounts.current_balance` fresco (decisión de la
hidratación: el saldo viene del servidor, nunca se recomputa local).

### 2. Migración (append-only)

```sql
-- Cursor del pull incremental de transactions — parcial: las soft-deleted
-- igual deben viajar (el delete de A tiene que llegar a B), así que SIN
-- filtro de deleted_at.
CREATE INDEX transactions_household_updated_idx
  ON public.transactions (household_id, updated_at);
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
2. Pull incremental de `transactions`: `updated_at > watermark`, paginado
   (mismo `fetchPaged`), orden `(updated_at, id)`.
3. Refresh completo de las tablas chicas.
4. Invalidar las query keys afectadas.

### 5. Regla de merge (la única decisión delicada)

Por fila bajada: **si el outbox tiene una entrada pendiente/failed/dead para
ese `entityId`, la fila local NO se pisa** — la versión local está en camino
al servidor; el push la consolida y el próximo pull la trae de vuelta ya
unificada. Sin entrada pendiente, `bulkPut` y el servidor gana (su
`client_rev` es la última escritura consolidada; el conflicto de ediciones
simultáneas ya lo detecta el push por `client_rev`, no hace falta duplicarlo
acá). Los soft-delete viajan como filas con `deleted_at` — mismo camino, sin
casos especiales.

### 6. Realtime (fase posterior, opcional)

Suscripción `postgres_changes` por household para latencia sub-segundo, con
el pull incremental quedando como red de seguridad (reconexiones, mensajes
perdidos). Exige habilitar la publication y revisar que RLS filtre los
eventos. No entra en la primera implementación: el pull de 30 s ya da un
multi-dispositivo utilizable.

## Riesgos conocidos

- **Filas que salen del alcance de `can_see`** (visibilidad cambiada por otro
  miembro): el pull no trae un "ya no podés ver esto", así que la copia local
  queda zombie hasta la próxima hidratación completa. Mitigación simple si
  molesta en la práctica: comparar los `id` del refresh completo de `accounts`
  /`categories` y podar huérfanos.
- **Reloj del servidor vs. `updated_at` escrito por el cliente**: los repos
  escriben `updatedAt` con la hora del dispositivo. Un dispositivo con reloj
  atrasado produce filas "viejas" que otro peer podría saltear pese al solape.
  Mitigación de fondo (si aparece): trigger server-side que pise `updated_at`
  con `now()` en cada write — decisión aparte porque cambia qué significa la
  columna para el resto del código.

## Fases y tamaño

| Fase | Contenido | Tamaño |
|------|-----------|--------|
| F1 | Migración del índice + `pull.ts` (cursor, merge, refresh chicas) + tests unitarios del merge | 1 sesión |
| F2 | Cableado al tick del sync-loop + invalidaciones + e2e de dos contextos (A escribe, B ve) | media sesión |
| F3 | Realtime opcional | sesión aparte |
