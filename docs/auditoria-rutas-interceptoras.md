# Rutas interceptoras: la causa del "loading en loop" y qué auditar

> **Para quien lea esto**: es un informe de causa raíz **más** un encargo de auditoría. La primera
> mitad explica un bug que costó tres intentos fallidos de arreglo antes de encontrarlo; la segunda
> lista los lugares donde el mismo problema sigue vivo, en silencio, y qué hay que decidir en cada
> uno. Todo lo que está acá está verificado contra el repo salvo lo que se marca explícitamente
> como hipótesis.

## 0. Estado al 2026-08-05

El encargo se ejecutó parcialmente. Lo que cambió desde que se escribió el resto del documento:

| Punto | Estado |
|---|---|
| Medir el alcance con evidencia (§ 8.1) | **Hecho.** Resultado abajo, en § 3. No se reprodujo |
| Migrar `transactions` (§ 5.1) | **Hecho.** `/transactions?tx=<id>`, mismo patrón que cuentas |
| Auditar `@modal/(.)add` y `@modal/(.)accounts/new` (§ 5.2) | Medidas, **sin decisión escrita** |
| Bugs silenciosos abiertos (§ 6) | **Sin tocar** |
| Convención escrita (§ 5.3) | **Hecha**, en `CLAUDE.md` § "Convención de rutas" |

Y dos correcciones a lo que este documento afirmaba:

- **Quedan DOS rutas interceptoras vivas, no tres**, y una está mal nombrada más abajo: es
  `@modal/(.)accounts/**new**`, que intercepta solo `/accounts/new`, no `(.)accounts` entero.
- **El bug de Next no se reproduce a pedido.** Sigue siendo real —los 45 errores del log original
  no se inventaron— pero el disparador no es "un guardado con HMR", que es lo que este documento
  daba por sentado. Ver § 3.

---

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

### Qué dio la medición (2026-08-05, Next 16.2.6)

Se midió con el procedimiento de arriba, sobre un dev server recién arrancado y con el log
limpio (0 errores de baseline). Los guardados con HMR se dispararon con un script que agrega y
saca un comentario de un archivo fuente cada 12–20 s; la navegación se automatizó por el
navegador para que fuera reproducible y no dependiera de la coordinación a mano.

| Escenario | Navegaciones por el interceptor | Recompiles HMR | Errores | Recargas |
|---|---|---|---|---|
| `/transactions` detalle, HMR sobre un hook | ~55 | 15 | **0** | 1 |
| `/add` como modal | 6 ciclos abrir/cerrar | 7 | **0** | 0 |
| `/accounts/new` como modal | 6 ciclos | 6 | **0** | 0 |
| `/transactions`, HMR sobre `transactions/page.tsx` | ~25 | 19 | **0** | 0 |
| **Total de la sesión** | **~90** | **61** | **0** | 11 |

**Ninguna de las tres rutas interceptoras acumuló un solo `(.)` en 61 actualizaciones de HMR.**
La única recarga con explicación clara llegó 0,66 s después de un recompile: es el fallback
normal de Turbopack cuando no puede aplicar el HMR en caliente sobre un hook, no el bug.

Esto **no contradice** el informe original —45 errores en un log real son 45 errores— pero sí
invalida el modelo mental de que cada guardado suma un marcador. Si fuera así, 61 guardados lo
habrían mostrado.

**Hipótesis vigente, sin verificar:** la acumulación ocurre cuando el dev bundler
**re-recolecta el árbol de rutas**, no en cada HMR. Eso pasa al **crear, borrar o renombrar
archivos de ruta** —lo que uno hace durante horas de desarrollo real sobre una sección— y no al
editar el contenido de archivos existentes, que es lo único que hicieron estas cuatro corridas.
El test que falta es mutar el árbol de rutas en loop y volver a medir.

**Consecuencia práctica:** no se puede usar "está pasando ahora" como argumento para priorizar
una migración. El argumento que sí se sostiene es el otro, y es independiente de Next: elegir
otro registro de una lista es la misma pantalla, y hacerlo pasar por una navegación de ruta
desmonta el layout para cambiar una columna. Eso parpadea también en producción.

## 4. Cómo se resolvió: cuentas como implementación de referencia

> Cuentas fue la primera. `transactions` se migró después con esta misma receta — ver § 5.1 y, para
> la versión normativa y generalizada, `CLAUDE.md` § "Convención de rutas".

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

Quedan **dos** rutas interceptoras vivas:

```text
src/app/(app)/@modal/(.)add
src/app/(app)/@modal/(.)accounts/new     ← intercepta solo /accounts/new
```

### 5.1. `transactions/@detail/(.)[id]` — RESUELTO

Migrada a `/transactions?tx=<id>`, mismo patrón que cuentas. Lo que se hizo:

- **Nuevos:** `TransactionsListContent.tsx` (la lista, que antes vivía dentro de `page.tsx` y el
  layout importaba desde ahí), `TransactionDetailContent.tsx` (el cuerpo del viejo `[id]/page.tsx`,
  recibiendo `{ id }`) y `TransactionsDetailEmpty.tsx` (el empty state más el `CategoryRadarChart`
  del viejo `@detail/default.tsx`, ahora un render condicional del contenedor).
- **Borrados:** `transactions/layout.tsx` entero —las 96 líneas de `DETAIL_ID_PATTERN`,
  `initialPathname` y la detección vieja de hard-nav— y todo `transactions/@detail/`: el
  interceptor, el `default.tsx` obligatorio del slot y el hack de especificidad de `calendar`.
- **`page.tsx`** pasó a contenedor master-detail, con `DetailHeaderBridge` montado después de la
  lista.
- **`[id]/page.tsx`** quedó como redirect de compatibilidad. El directorio sigue vivo para `edit`
  y `split`.
- **El `window.location.href` de "Calendario" volvió a ser `router.push`.** Era una recarga dura a
  propósito para esquivar al interceptor; sin interceptor no hay nada que esquivar.
- **Al abrir un movimiento se conservan los demás search params.** La lista recibe filtros por URL
  desde el home (`?kind=`, `?from=`, `?to=`, `?pending=`) y desde el buscador (`?category=`,
  `?payee=`); armar la URL desde cero los borraba y al cerrar devolvía a una lista sin filtrar.
  Este punto no estaba previsto en el encargo y es el que más fácil se pasa por alto.
- **Call sites actualizados:** home, calendario, detalle de cuenta, resumen de tarjeta y
  `search-overlay.tsx`. Los de `/edit` y `/split` no se tocaron: son rutas de verdad.
- **Tests:** `navigation-uses-replace.test.ts` (el caso apunta ahora a `TransactionDetailContent`,
  con 1 `back()` en vez de 2 porque el del header se mudó al contenedor), las tres esperas de URL
  de `e2e/navigation-replace.spec.ts` y los fixtures de `src/lib/search/rank.test.ts`.

La convención para que esto no se reintroduzca quedó escrita en `CLAUDE.md`, § "Convención de
rutas".

### 5.2. `@modal/(.)add` y `@modal/(.)accounts` — evaluar, no migrar por reflejo

Estos dos son **distintos** y no hay que tratarlos como el caso anterior:

- No son master-detail. Son "abrir un flujo de alta como modal encima de donde estabas".
- `@modal/(.)add` implementa un patrón que `CLAUDE.md` documenta explícitamente como decisión
  cerrada: `/add` tiene que funcionar tanto por deep link duro (shortcut de la PWA, share target)
  como por modal desde adentro. Esa dualidad es justamente para lo que sirven las rutas
  interceptoras.
- Migrarlos a search param es posible pero cambia la semántica de la URL de un flujo de captura que
  está en el camino crítico del producto (la métrica de "cargar un gasto en menos de 5 segundos").

**Lo que había que decidir con evidencia**: ¿estas dos rutas también acumulan `(.)` y fuerzan
recargas? **Medido: no, o al menos no de forma reproducible** — ver la tabla de § 3. Doce ciclos
de abrir/cerrar los dos modales con 13 recompiles de HMR encima dieron cero errores. Tampoco se
observó el portal huérfano de § 4: después de cerrar con `back()`, la pantalla de abajo quedó
limpia en los dos casos. Eso se probó **solo en desktop**; el camino de mobile con `Modal` sin
`contained` sigue sin verificar.

Con eso, la decisión sigue abierta pero ya no es a ciegas. La lectura recomendada, a confirmar:

- **`(.)add` no se migra.** Es decisión cerrada de `CLAUDE.md`, está en el camino crítico de la
  métrica de los 5 segundos, y `/add?modal=1` sería peor semántica. Si algún día acumula, la
  mitigación es reiniciar el dev server, no rediseñar el flujo de captura.
- **`(.)accounts/new` es el candidato real a eliminar.** Aporta mucho menos —no hay share target
  ni shortcut de la PWA apuntando a `/accounts/new`— y su propio comentario ya dice que la mitad
  de su razón de ser desapareció cuando se migró el detalle de cuenta. Sacarlo baja la superficie
  de acumulación sin discutir nada de producto.

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

1. ~~**Confirmar el alcance con evidencia**~~ — **hecho**, § 3. No se reprodujo en 61 recompiles.
   Queda una hipótesis sin verificar sobre el disparador real.
2. ~~**Auditar las rutas interceptoras vivas**~~ — **hecho** para las tres, incluido el portal
   huérfano de § 4. Falta el camino de mobile.
3. ~~**Plan de corrección priorizado**~~ — **hecho y ejecutado** en su parte mecánica:
   `transactions` migrada (§ 5.1). La parte que necesita decisión de producto sigue abierta
   (§ 5.2).
4. **Verificar los hallazgos abiertos de § 6** — **pendiente, sin tocar.** Son tres:
   `enqueueAccountUpdate` fallando en silencio, `usePageHeader` sin array de dependencias, y el
   `window.location.reload()` del service worker sin rastro en el log.
5. ~~**Dejar la convención escrita**~~ — **hecha** en `CLAUDE.md`, § "Convención de rutas", con la
   receta de siete pasos y los seis pares de CONS-DESK nombrados.

Criterio de verificación para cualquier migración que salga de esto: `pnpm lint`, `npx tsc --noEmit`,
`npx vitest run`, `pnpm build`, más la prueba de § 3 con el server recién reiniciado. Y actualizar
`e2e/navigation-replace.spec.ts`, que tiene esperas de URL con la forma vieja.
