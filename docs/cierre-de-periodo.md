# Cierre de período: lo que pasó, pasó

Idea evaluada y aprobada en principio el 10 de agosto de 2026, **diseñada en detalle el mismo
día, sin implementar todavía.** Se separó a propósito del resumen mensual por mail
(`docs/resumen-mensual-por-mail.md`): es una decisión de producto mucho más grande y no debe
decidirse como efecto secundario de una optimización de ese trabajo.

## La idea

Una vez que cierra el período del hogar, lo que quedó adentro **no se edita más**: ni se modifica,
ni se borra, ni se agrega. El balance del mes cerró. Cualquier corrección posterior entra como una
**conciliación** — un movimiento de ajuste, fechado en el período en curso, con una nota que la
justifica.

La pieza ya existe: `/accounts/[id]/reconcile` genera un movimiento `kind: 'adjustment'` con nota.
No hay que inventar el mecanismo de corrección, solo decidir cuándo pasa a ser el único disponible.

## Qué gana

**Los saldos históricos dejan de ser dato derivado frágil.** `account_balance_snapshots` ya existe
en el schema desde la migración de cuentas (`20260801010500_accounts.sql`), con su RLS heredando de
`accounts` vía `can_see`, pero **está vacía: nadie la escribe ni la lee**. El motivo por el que no
se puede poblar hoy es exactamente este: si el pasado se puede editar, todo snapshot posterior queda
mal y hay que recalcular en cascada. Con el período cerrado, un snapshot es un hecho y no vuelve a
tocarse nunca.

Eso desbloquea, sin recalcular nada: el patrimonio histórico, el resumen anual, el saldo de apertura
de cualquier período en una lectura de una fila, y el gráfico de evolución sin escanear la historia.

**El resumen mensual pasa a ser definitivo.** Hoy, un mail del período pasado puede quedar
desactualizado si alguien edita algo de ese mes al día siguiente. Con el cierre, lo que dice el mail
es lo que quedó.

## El problema que hay que resolver antes: local-first

**La app promete que nunca pierde un gasto**, y esa promesa está por encima de esta funcionalidad.

Si alguien carga movimientos sin conexión y sincroniza tres días después, esos movimientos pueden
pertenecer a un período ya cerrado. Un bloqueo duro los rechazaría. Eso no puede pasar.

Dos amortiguadores, los dos necesarios:

**Ventana de gracia entre el cierre y el bloqueo.** El período cierra el día que cierra, pero el
snapshot se escribe y el bloqueo entra recién unos días después. Cubre sin fricción los dos casos
normales: la sincronización demorada y la carga con fecha pasada ("me olvidé del almuerzo del
lunes"). Son 7 días, fijo en v1 — ver "Diseño (v1)" más abajo.

**Un movimiento que llega del outbox nunca se rechaza.** Si cae en un período ya bloqueado, se
acepta igual y se recalcula ese snapshot. Con la ventana, eso pasa a ser un evento raro y
detectable en vez de la operación normal — y conviene avisarle al usuario que ocurrió, en lugar de
ajustar el pasado en silencio.

La diferencia con no tener cierre no es que el recálculo desaparezca: es que deja de ser el caso
común y pasa a ser la excepción.

## Diseño (v1) — sesión del 10 de agosto de 2026

Investigado contra el código real antes de decidir nada (no contra lo que este documento
suponía). Tres hallazgos cambiaron el diseño respecto de lo que se esperaba al aprobar la idea:

- **`account_balance_snapshots` (`20260801010500_accounts.sql`) solo guarda `balance` en moneda
  de cuenta** — PK `(account_id, as_of)`, sin `amount_base` ni ninguna columna de moneda base.
  Eso significa que el cierre puede (y debe) bloquear únicamente el **libro mayor** — monto,
  cuenta, categoría, `kind`, fecha — sin tocar nunca `fx_rate`/`amount_base`. El caso borde que
  esta sección de abajo marcaba como "el más incómodo" deja de serlo: un snapshot en moneda de
  cuenta no depende de si el `fx_rate` ya se resolvió.
- **El mecanismo para bloquear una columna sin que RLS lo pueda hacer solo ya existe.**
  `enforce_immutable_columns()` (`20260801130000_immutability_triggers.sql`) es un trigger
  genérico `BEFORE UPDATE` que compara `OLD`/`NEW` de verdad — algo que un `WITH CHECK` de RLS no
  puede hacer porque no ve la fila vieja. El cierre de período reutiliza el mismo patrón en vez
  de inventar uno nuevo.
- **`household_period_start()` (Postgres) y `periodStart()` (`src/lib/analytics/history.ts`)
  vivían duplicados y podían divergir** — el primero clampea el día de cierre al último día del
  mes, el segundo no. Hoy no era explotable (`CLOSE_DAYS` en `/more/settings` limita a 1-28, así
  que "31 en febrero" no se podía producir), pero el cierre de período depende de que cliente y
  servidor coincidan en qué período es cuál — corregido en esta sesión (`history.ts` clampea
  igual que Postgres ahora, con test de regresión), antes de construir nada encima.

### Decisiones cerradas en esta sesión

1. **El lock es angosto: protege el libro mayor, nunca `fx_rate`/`amount_base`.** Completar un
   `pending` sigue siendo la única escritura legítima de `amount_base` post-inserción
   (`CLAUDE.md`), y sigue siéndolo también dentro de un período cerrado. Un mail mensual/anual ya
   enviado puede quedar desalineado si su `pending` se resuelve después — mismo comportamiento
   que hoy (el mail es una foto del momento de envío), no es una regresión nueva.
2. **Flag por household, apagado por defecto.** `households.period_lock_enabled boolean NOT NULL
   DEFAULT false`. No es de los seis módulos opcionales (`CLAUDE.md`), pero se activa igual de a
   un hogar a la vez mientras se valida el mecanismo — un bug en el trigger con esto global desde
   el día uno bloquearía la edición de historial a todos los hogares a la vez.
3. **7 días de gracia, fijo en v1 (no configurable por hogar).** El período cierra el día que
   cierra; `households.closed_through date` (el watermark: todo `occurred_at <= closed_through`
   está bloqueado) avanza recién 7 días después, vía el cron de la sección siguiente.
4. **`period_start_day` unificado.** Ver hallazgo arriba — ya corregido.

### Modelo de datos

- `households.period_lock_enabled boolean NOT NULL DEFAULT false`
- `households.closed_through date` — `NULL` hasta el primer cierre. El watermark, no una tabla de
  períodos: como los cierres son secuenciales y monótonos, una sola fecha por hogar alcanza y
  evita mantener N filas de "período X está cerrado".
- `account_balance_snapshots` se reutiliza tal cual — sin migración de schema. `as_of` = último
  día del período cerrado, `balance` en moneda de cuenta, calculado con la misma
  `recompute_account_balance()` que ya recalcula `current_balance` hoy
  (`20260801010700_transactions.sql`).

### Mecanismo de enforcement

Trigger `BEFORE UPDATE`, mismo patrón que `enforce_immutable_columns()`, función nueva
`enforce_period_lock()` en `transactions`, `trades` y `settlements`:

- Si `household.period_lock_enabled` y `OLD.occurred_at::date <= household.closed_through`:
  permitir el `UPDATE` **solo** si el único delta es completar `fx_rate` / `fx_source` /
  `fx_provider` / `fx_quote_kind` / `fx_resolved_at` / `amount_base` desde `NULL` (la lista
  exacta que `resolvePendingFx` toca — `src/features/movements/resolve-pending-fx.ts`). Cualquier
  otro cambio: `RAISE EXCEPTION` con `ERRCODE = '23514'` (mismo código que usa
  `enforce_immutable_columns`) y un mensaje que el cliente pueda reconocer.
- **El borrado ya es un `UPDATE`** (`deleted_at`, nunca un `DELETE` real — confirmado en las
  policies de las tres tablas). El mismo trigger lo cubre sin código aparte: responde la pregunta
  abierta de si el bloqueo alcanza al borrado con un sí automático, no una decisión nueva.
- Los hijos (`transaction_splits`, `transaction_shares`) necesitan el mismo trigger resolviendo
  `occurred_at`/`household_id` vía `EXISTS` sobre el padre — el detalle exacto de esa consulta
  queda para implementación, no cambia el diseño.

### INSERT tardío en un período cerrado — el caso que el outbox nunca puede rechazar

Esto es lo que separa "bloquear edición" de "bloquear todo", y es la pieza que este documento no
había resuelto antes de esta sesión:

- **La UI de captura/edición nunca ofrece una fecha dentro de un período cerrado** cuando el
  hogar tiene el flag activo — el selector de fecha no la deja elegir, y en su lugar apunta a la
  conciliación. Esto es lo que evita que "insertar" se use como puerta trasera para lo que
  "editar" ya bloquea.
- **El servidor jamás rechaza un `INSERT` por fecha**, pase lo que pase — esa es la promesa que
  protege la carga offline. Por construcción de la regla anterior, un `INSERT` que aterriza con
  `occurred_at` dentro de `closed_through` **solo puede ser** un movimiento que salió del
  dispositivo antes del cierre y llegó tarde por la red: nunca una elección deliberada en el
  momento, porque la UI no la ofrece.
- Ese `INSERT` tardío dispara (trigger `AFTER INSERT`) el recálculo de los `account_balance_snapshots`
  de esa cuenta con `as_of >= occurred_at` del movimiento tardío, reutilizando
  `recompute_account_balance()` a una fecha de corte, y deja registrado que el cierre de ese
  período se ajustó — mecanismo de aviso concreto (dónde se guarda, qué ve el usuario) queda para
  implementación, pero el principio ya está fijado por `CLAUDE.md`: se avisa, nunca se ajusta el
  pasado en silencio.

### Escritura de snapshots y avance del watermark

Cron diario nuevo, mismo patrón que `card_settlement` / `monthly-summary` (Edge Function +
`pg_cron`, `supabase/migrations/20260801160000_cron_engines.sql` y
`20260810190000_monthly_summary_schedule.sql`): por cada household con `period_lock_enabled`,
calcula con `household_period_start()` el período que cerró hace ≥ 7 días; si `closed_through`
todavía no llegó a ese fin de período, escribe un `account_balance_snapshots` por cuenta
(`as_of` = fin de período) y avanza `closed_through`. Idempotente por la PK existente
`(account_id, as_of)` — un reintento del cron no duplica nada.

### UI/UX

- Al intentar editar/borrar un movimiento bloqueado: la app reconoce el error del trigger (código
  y mensaje) y en vez de un toast de error abre el flujo de conciliación de la cuenta
  correspondiente — nunca "no se puede editar" a secas (`CLAUDE.md` — los errores proponen la
  corrección, no la nombran).
- El date picker de captura y edición oculta/deshabilita fechas dentro de un período cerrado
  cuando el hogar tiene el flag activo.
- El toggle del flag (ubicación exacta a definir, probablemente `/more/settings` junto a
  `period_start_day`) lleva la misma advertencia de puerta de una sola dirección que ya tiene
  este documento — acá encenderlo es lo irreversible sobre el historial que ya está cerrado, al
  revés de "apagar un módulo" que solo oculta.

### Qué queda para la fase de implementación, no para el diseño

- SQL exacto de `enforce_period_lock()`, del trigger de recompute de snapshots y de la
  propagación a `transaction_splits`/`transaction_shares`.
- Mecanismo concreto de aviso al usuario del ajuste tardío (¿`insights`? ¿una tabla nueva?).
- Copy final en ES/EN/PT del mensaje de bloqueo y del aviso de ajuste tardío.
- Extender `trades`/`settlements` con el detalle exacto de columnas permitidas por tipo (no todas
  tienen un equivalente a `fx_rate`/`amount_base`, hay que revisar cada schema).
- Dónde vive el toggle del flag y su copy de advertencia.

## Por qué no se hizo ya

Dos motivos, los dos de peso.

**Es una puerta de una sola dirección.** La inmutabilidad es fácil de agregar y muy difícil de
sacar una vez que alguien depende de ella.

**Cambia el modelo de edición de toda la app**, no de una pantalla. Merece su propio diseño, sus
propias pruebas y su propia decisión — no entrar por la ventana para ahorrarle un escaneo a un mail
mensual.

Mientras tanto, el resumen mensual calcula el saldo de apertura con una agregación en Postgres: no
necesita snapshots, no crece con la historia, y el día que los snapshots existan los aprovecha sin
cambiar una línea de su lógica.
