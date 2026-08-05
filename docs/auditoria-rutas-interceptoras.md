# Rutas interceptoras: la causa del "loading en loop" y qué auditar

> **Para quien lea esto**: es un informe de causa raíz **más** un encargo de auditoría. La primera
> mitad explica un bug que costó tres intentos fallidos de arreglo antes de encontrarlo; la segunda
> lista los lugares donde el mismo problema sigue vivo, en silencio, y qué hay que decidir en cada
> uno. Todo lo que está acá está verificado contra el repo salvo lo que se marca explícitamente
> como hipótesis.

## 1. El síntoma, y por qué costó tanto

En `/accounts`, archivar o desarchivar una cuenta dejaba la app clavada en el spinner de arranque
(el `ZMark` animado de `OnboardingGate`), en loop, sin salida que no fuera recargar a mano. Y
cambiar de una cuenta a otra daba un "golpe" de UI que se sentía como una recarga.

Se intentó arreglar tres veces sobre causas equivocadas:

1. Se blindó `DbOwnerSync` con `try`/`finally` (era un agujero real, pero no este bug).
2. Se corrigió la detección de hard-nav en `accounts/layout.tsx` (también real, tampoco era).
3. Se agregó invalidación del detalle y se sacó una carrera en los handlers de archivar.

Ninguno funcionó porque **el error nunca aparecía en la consola del navegador**. Estaba en el log
del servidor de desarrollo. Esa es la lección más transferible de todo el episodio:

> Cuando un síntoma de UI no tiene ningún error en la consola del navegador, mirá
> `.next/dev/logs/next-development.log` antes de seguir teorizando. Un error de servidor durante
> una navegación de cliente se manifiesta como un problema visual sin rastro en el cliente.

## 2. La causa raíz

Es un bug abierto de Next.js: [vercel/next.js#91265](https://github.com/vercel/next.js/issues/91265).
Confirmado en Next **16.2.6** (la versión del repo).

`setup-dev-bundler.js` agrega las rutas interceptoras a `beforeFiles` **en cada actualización de
HMR, sin limpiar las anteriores**. El marcador de interceptación se acumula: un guardado, un `(.)`
más. Después de un rato de desarrollo la ruta queda así:

```text
⨯ Error: Invalid interception route: /accounts/(.)(.)(.)…(.)019fcb42-a837-7567-a669-04c2469a1788
  Must be in the format /<intercepting route>/(..|...|..)(..)/<intercepted route>
```

Cuando eso pasa, cualquier navegación que involucre esa ruta interceptora tira un error de
servidor, y Next fuerza una recarga completa de página. La recarga vuelve a chocar contra la misma
tabla de rutas corrupta, y se encadena.

Medido sobre el log real del usuario (sesión de ~5 h, decenas de guardados):

| Métrica | Valor |
|---|---|
| Errores `Invalid interception route` | 45 |
| — en `/accounts/` | 26 |
| — en `/transactions/` | 19 |
| Errores seguidos de una recarga completa, en < 1 s | **44 de 45** |
| Recargas encadenadas (< 6 s entre una y otra) | 26, en ráfagas de 3–4 |

Esa ráfaga de recargas **es** el "loading en loop": cada recarga vuelve a mostrar el spinner de
arranque y vuelve a fallar. Y es también el "golpe" al cambiar de registro: no era una transición
mal animada, era una recarga real de documento.

### Alcance del bug

- **Es solo en desarrollo** (HMR con Turbopack). Una build de producción no se ve afectada: el
  usuario final nunca lo sufre.
- **Reiniciar el dev server lo limpia** — hasta que se vuelva a acumular. Por eso es tan
  traicionero: aparece y desaparece sin relación aparente con el código que se está tocando, y
  culpa al último cambio que uno hizo.
- Cuanto más se trabaja sobre una zona con rutas interceptoras, más rápido se degrada.

## 3. Cómo detectarlo (procedimiento, no intuición)

```bash
# ¿Está pasando ahora?
grep -c "Invalid interception route" .next/dev/logs/next-development.log

# ¿En qué secciones?
grep -o "Invalid interception route: /[a-z]*/" .next/dev/logs/next-development.log | sort | uniq -c
```

Para confirmar que los errores están causando recargas —y no son ruido inocuo— hay que correlacionar
cada error con lo que viene inmediatamente después. Una recarga de página deja dos marcas
reconocibles en el log: `Dexie: handling persisted pagehide` y el mensaje de arranque de React
DevTools. Si casi todos los errores están seguidos de una de esas dos en menos de un segundo, el
error está forzando recargas.

**Antes de medir cualquier cosa, reiniciar el dev server.** Un log heredado de una sesión anterior
mide el bug de Next acumulado, no el estado del código.

## 4. Cómo se resolvió: cuentas como implementación de referencia

Se migró el master-detail de cuentas de **ruta interceptada** a **search param**:

```text
antes:   /accounts/[id]        (interceptado por accounts/@detail/(.)[id])
después: /accounts?account=<id>
```

Si no hay ruta interceptora, no hay nada que acumule marcadores. El bug de Next deja de aplicar por
construcción, no por parche.

### Qué se borró

| Archivo | Por qué existía |
|---|---|
| `accounts/@detail/(.)[id]/page.tsx` | El interceptor |
| `accounts/@detail/default.tsx` | Obligatorio para todo slot paralelo |
| `accounts/@detail/new/page.tsx` | Hack de especificidad: sin esto el interceptor reclamaba `"new"` como id |
| `accounts/@detail/resolve-fx/page.tsx` | Mismo hack, para `"resolve-fx"` |
| `accounts/layout.tsx` (101 líneas) | `DETAIL_ID_PATTERN`, `DETAIL_OWNED_PATHNAME`, `bornFromHardNav`… todo compensación de rarezas de interceptación |

Neto en `accounts/`: **−503 líneas, +162**.

### Qué se creó o cambió

- `accounts/page.tsx` pasó de wrapper de 8 líneas a contenedor master-detail: lee el param, y
  renderiza `SplitGrid` (lista + detalle) en desktop o lista + `<Modal>` condicional en mobile.
  El `SplitGrid` se mudó tal cual desde el layout borrado.
- `accounts/AccountDetailContent.tsx` (nuevo): el cuerpo del viejo `[id]/page.tsx`, recibiendo
  `{ id }: { id: string }` en vez de `params`.
- `accounts/[id]/page.tsx`: quedó como redirect de compatibilidad a `/accounts?account=<id>`, para
  favoritos y entradas de historial viejas de la PWA. El directorio `[id]/` tiene que existir igual
  para los sub-flujos (`card`, `installments`, `reconcile`).

### Decisiones de navegación que hay que replicar

- **Abrir con `push`, no `replace`**: `router.push(\`/accounts?account=${id}\`, { scroll: false })`.
  `push` para que el botón atrás del navegador y el de Android cierren el detalle — en una PWA ese
  es *el* gesto para cerrar. `{ scroll: false }` para que la lista no salte al tope (es la mitad
  micro del "golpe").
- **Cerrar siempre con `router.back()`**, simétrico al `push`. Nunca `replace` a la URL de la lista:
  si esa URL ya está debajo en el historial, `replace` **duplica** la entrada en vez de evitarla, y
  "volver" necesita dos toques. Ese bug ya se cometió y se corrigió antes en este repo; está
  documentado en `src/app/__tests__/navigation-uses-replace.test.ts`.
- **El header del shell** lo registra el contenedor, no el detalle. `usePageHeader` sobrescribe su
  config en cada render sin cleanup (ver `design-system/nav/page-header-context.tsx`), así que dos
  consumidores montados a la vez —lista y detalle en desktop— se pisan. La solución fue un
  componente chico (`DetailHeaderBridge`) montado solo cuando corresponde y **después** de la lista
  en el JSX, para que su efecto corra último.

### Un beneficio colateral que conviene entender

El detalle interceptado se dibujaba dentro de `<Modal>`, que hace `createPortal(overlay, document.body)`.
Con `cacheComponents: true`, `router.back()` **no desmonta** una pantalla de ruta: la deja oculta en
modo `Activity`. Y **`Activity` no puede ocultar contenido portaleado a `document.body`** — el
overlay (`position:fixed; inset:0; z-index:50`, fondo opaco) podía sobrevivir tapando la pantalla
entera después de volver atrás.

Con el param, el `Modal` es un render condicional común dentro de la misma ruta, así que se desmonta
normalmente. **Este riesgo aplica a cualquier ruta interceptada que renderice un portal**, y es un
punto obligado de la auditoría.

## 5. Lo que falta auditar

Quedan tres rutas interceptoras vivas:

```text
src/app/(app)/transactions/@detail/(.)[id]     ← el gemelo directo del caso ya resuelto
src/app/(app)/@modal/(.)add
src/app/(app)/@modal/(.)accounts
```

### 5.1. `transactions/@detail/(.)[id]` — prioridad alta

Es el mismo patrón que cuentas, con los mismos archivos y las mismas cicatrices. **19 de los 45
errores del log eran de `/transactions/`**, así que no es teórico: está pasando hoy, solo que el
usuario reportó cuentas primero.

Evidencia concreta a revisar:

- `transactions/layout.tsx:84-86` todavía usa la detección **vieja** de hard-nav
  (`initialPathname` congelado comparado contra el `pathname` actual). Cuentas ya la había
  reemplazado porque provocaba que, al abrir un segundo registro, el detalle se dibujara en la
  columna de la lista y la lista desapareciera — se percibía exactamente como "recarga". Acá sigue
  sin corregir.
- `transactions/page.tsx:293` tiene `window.location.href = "/transactions/calendar"` — una recarga
  dura **a propósito**, puesta para esquivar al interceptor. Es el gemelo exacto del hack que había
  en cuentas para `resolve-fx` y que se borró en esta migración. Si el interceptor se va, esto vuelve
  a ser un `router.push` normal.
- `transactions/@detail/calendar/page.tsx` es el mismo hack de especificidad que
  `accounts/@detail/resolve-fx/page.tsx`.
- `transactions/@detail/default.tsx` es más pesado que el de cuentas: renderiza un
  `CategoryRadarChart` para que la columna derecha no quede vacía en desktop. Migrarlo implica
  decidir dónde vive eso ahora (probablemente inline en el contenedor, igual que el `EmptyState` de
  cuentas).

Los call sites a `/transactions/<id>` hay que enumerarlos igual que se hizo con cuentas
(`grep -rn 'transactions/' src --include='*.tsx' | grep '\${'`), sin olvidar `search-overlay.tsx` y
su test en `src/lib/search/rank.test.ts`, ni las esperas de URL en `e2e/navigation-replace.spec.ts`.

### 5.2. `@modal/(.)add` y `@modal/(.)accounts` — evaluar, no migrar por reflejo

Estos dos son **distintos** y no hay que tratarlos como el caso anterior:

- No son master-detail. Son "abrir un flujo de alta como modal encima de donde estabas".
- `@modal/(.)add` implementa un patrón que `CLAUDE.md` documenta explícitamente como decisión
  cerrada: `/add` tiene que funcionar tanto por deep link duro (shortcut de la PWA, share target)
  como por modal desde adentro. Esa dualidad es justamente para lo que sirven las rutas
  interceptoras.
- Migrarlos a search param es posible pero cambia la semántica de la URL de un flujo de captura que
  está en el camino crítico del producto (la métrica de "cargar un gasto en menos de 5 segundos").

**Lo que hay que decidir con evidencia, no a priori**: ¿estas dos rutas también acumulan `(.)` y
fuerzan recargas? El log histórico solo mostró errores de `/accounts/` y `/transactions/`, pero eso
puede ser simplemente porque son las secciones que más se navegaron durante esa sesión. Hay que
reproducir: abrir `/add` como modal repetidas veces intercalando guardados con HMR, y mirar el log.

Si acumulan, las opciones no son solo "migrar": también sirve reducir la superficie (menos rutas
interceptoras = menos acumulación) o esperar el fix de Next para un flujo donde la interceptación
sí aporta valor real. **Este es un juicio que hay que argumentar, no resolver mecánicamente.**

### 5.3. Los ~6 pares lista/detalle que todavía no tienen split view

`docs/plan-de-trabajo.md` (CONS-DESK) deja anotado que metas, presupuestos, recurrentes, deudas,
familia e inversiones van a recibir el mismo patrón de dos columnas, y que no se hizo por tiempo.

**Ninguno debe recibir el patrón de rutas interceptoras.** El approach de search param es
sustancialmente más barato de replicar: no necesita slot paralelo, ni `default.tsx`, ni archivos de
especificidad por cada ruta hermana. Cuentas es la implementación de referencia.

Vale la pena que la auditoría deje esto escrito como convención en `CLAUDE.md`, para que la próxima
sesión no reintroduzca el patrón viejo por imitación de `transactions/`.

## 6. Bugs silenciosos relacionados que salieron de la investigación

Salieron mientras se perseguía la causa. **Los dos primeros ya están arreglados**; el resto son
hallazgos abiertos, y conviene verificarlos porque comparten la propiedad de fallar sin ruido.

### Ya arreglados en esta sesión

- **`db-owner-sync.tsx`**: la cadena async no tenía `try`/`catch`. Si cualquier paso rechazaba,
  `setSettled(true)` nunca corría y `OnboardingGate` mostraba su spinner para siempre. Ahora está
  envuelto en `try`/`finally`.
- **`onboarding-gate.tsx`**: el `router.replace` de rescate se disparaba **una sola vez** por
  transición de `blocked`, sin reintento. Si ese replace se perdía, el gate quedaba clavado sin
  salida. Se agregó `pathname` a las deps para que cualquier cambio de ruta lo reintente.

### Abiertos, a verificar

- **`usePageHeader` corre un `useLayoutEffect` sin array de dependencias**
  (`design-system/nav/page-header-context.tsx`), llamando al `setState` del padre con un objeto
  literal nuevo en cada render. Hoy no entra en loop solo porque React hace bail-out cuando el
  elemento `children` es referencialmente idéntico. Es frágil: un wrapper sin `useMemo` en el medio
  lo convierte en "Maximum update depth exceeded". Además, dos consumidores montados a la vez se
  pisan el header (ver § 4).
- **`service-worker-register.tsx:50,77`**: hay un `window.location.reload()` que se dispara ante
  cualquier `unhandledrejection` cuyo mensaje matchee un patrón de "no se pudo cargar un chunk",
  borrando todo el Cache Storage antes. Es un mecanismo de recuperación legítimo para un deploy
  nuevo, pero significa que **existe un segundo camino por el que la app puede recargarse sola sin
  explicación visible**. Cualquier import dinámico que falle por una razón no relacionada produce
  una "recarga misteriosa". Vale la pena revisar si el patrón de match es lo bastante específico y
  si conviene loguear cuando se dispara. *(Hipótesis de un agente investigador, no verificada en
  ejecución.)*
- **`accounts-repo.ts` — `enqueueAccountUpdate` hace `if (!existing) return;`**: un `archive()`
  sobre una fila que no está resuelve exitosamente sin escribir nada. Falla en silencio.
- **`transactions/layout.tsx`** arrastra la detección de hard-nav vieja (§ 5.1).

## 7. Qué NO tocar

- **La build de producción no tiene este problema.** Nada de esto justifica un cambio que empeore
  producción para arreglar dev.
- **`@modal/(.)add` no se migra sin argumento explícito** (§ 5.2). Es una decisión cerrada de
  `CLAUDE.md`.
- **Los sub-flujos que son rutas de verdad siguen siéndolo**: `accounts/[id]/card`, `installments`,
  `reconcile`, `resolve-fx`, y los full-screen fuera del grupo `(app)` (`accounts/[id]/edit`,
  `accounts/new`). No son master-detail y no tienen nada que ver con el bug.
- **El redirect de compatibilidad** `accounts/[id]/page.tsx` no se borra: hay una PWA instalada con
  historial largo, y un 404 ahí sería una regresión real.

## 8. El encargo

1. **Confirmar el alcance con evidencia**, no por inspección de código: reiniciar el dev server,
   ejercitar `/transactions` (abrir un movimiento, abrir otro, editar, borrar) y `/add` intercalando
   guardados con HMR, y medir el log con el procedimiento de § 3. Reportar qué rutas acumulan y a
   qué velocidad.
2. **Auditar las tres rutas interceptoras vivas** contra los criterios de § 5, incluyendo el riesgo
   de portal huérfano de § 4 para cada una.
3. **Proponer un plan de corrección priorizado**, separando lo que es migración mecánica (el gemelo
   de `transactions`, con cuentas como referencia línea por línea) de lo que necesita una decisión
   de producto (`@modal/(.)add`).
4. **Verificar los hallazgos abiertos de § 6** y decidir cuáles entran en el plan y cuáles se dejan
   anotados.
5. **Dejar la convención escrita** para los ~6 pares que faltan (§ 5.3), para que el patrón viejo no
   se reintroduzca por imitación.

Criterio de verificación para cualquier migración que salga de esto: `pnpm lint`, `npx tsc --noEmit`,
`npx vitest run`, `pnpm build`, más la prueba de § 3 con el server recién reiniciado. Y actualizar
`e2e/navigation-replace.spec.ts`, que tiene esperas de URL con la forma vieja.
