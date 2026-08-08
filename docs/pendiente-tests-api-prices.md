# Pendiente — 2 tests de `/api/prices` fallando por fechas hardcodeadas

Estado al 8 de agosto de 2026, dejado documentado durante el fix de sincronización de v0.29.89
para resolver en una sesión aparte. **No bloquea nada de v0.29.89**: las fallas son
preexistentes, ajenas a ese cambio, y reproducen en el árbol limpio (verificado con
`git stash -u` + `pnpm test -- prices` + `git stash pop`).

## Síntoma

`pnpm test` falla siempre en `src/app/api/prices/route.test.ts`, 2 de sus 3 tests:

1. **"un snapshot de hoy del MISMO proveedor sí se usa como cache, sin pegarle a la API"** —
   espera `fetchPriceMock` sin llamadas, pero la ruta le pega a la API una vez (`TSLAm`).
2. **"un instrumento SIN proveedor (FCI, plazo fijo) sigue respetando el manual de hoy"** —
   espera `{ close: 1500, provider: "manual", isStale: false }` pero recibe `isStale: true`.

El primer test del archivo ("un snapshot 'manual' de hoy NO tapa la cotización real…") pasa.

## Diagnóstico

Los fixtures de los tres tests declaran el snapshot con **`as_of: "2026-08-06"` hardcodeado**,
que era "hoy" cuando se escribieron los tests. La ruta decide "¿este snapshot es de hoy?"
comparando contra la fecha real del sistema, así que desde el 7 de agosto:

- En el test 2, el snapshot del 6 ya no cuenta como cache de hoy → la ruta va a la API
  (`fetchPrice("TSLAm")`) en vez de servir del snapshot → falla el `not.toHaveBeenCalled()`.
- En el test 3, el manual del 6 ya no es "el manual de hoy" → la ruta lo sirve como viejo
  (`isStale: true`) → falla el `isStale: false`.
- El test 1 pasa de casualidad: su aserción depende de la respuesta del provider mockeado
  (`close: 33560`), no de la frescura del snapshot.

No se verificó línea por línea cómo `route.ts` calcula "hoy" (quedó fuera del alcance de la
sesión) — confirmar ahí si usa `todayIso()` o un `new Date()` propio antes de elegir el fix.

## Fix propuesto

Reemplazar las fechas hardcodeadas de los fixtures por la fecha real del día de la corrida:

- Si la ruta usa `todayIso()` (`src/lib/dates/today.ts`, D10): usar `todayIso()` también en los
  fixtures (`as_of: todayIso()` y, en el test 1, el `asOf` del mock del provider).
- Si la ruta calcula "hoy" por su cuenta con `new Date()`: además de arreglar los fixtures,
  evaluar migrarla a `todayIso()` — un `new Date().toISOString().slice(0, 10)` suelto es
  exactamente el bug de huso horario que `CLAUDE.md` prohíbe (adelanta la fecha entre las 21:00
  y las 00:00 en husos negativos).

Alternativa más robusta si se quiere fijar el reloj en vez de seguirlo: `vi.setSystemTime()` con
una fecha ancla y mantener los fixtures literales. Ojo con la nota de `outbox.test.ts`: los fake
timers cuelgan las transacciones reales de `fake-indexeddb` — acá no aplica (la suite de la ruta
no usa Dexie), pero conviene verificar que nada más del archivo dependa del reloj real.

## Criterio de cierre

- `pnpm test -- prices` en verde **en cualquier fecha y hora** (probar mentalmente el caso
  "21:00–00:00 hora de Uruguay": ahí es donde un "hoy" en UTC se adelanta un día).
- Suite completa en verde: con esto cerrado, `pnpm test` queda 965/965.
