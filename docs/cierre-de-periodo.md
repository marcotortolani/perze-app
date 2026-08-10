# Cierre de período: lo que pasó, pasó

Idea evaluada y aprobada en principio el 10 de agosto de 2026. **Sin diseñar en detalle y sin
implementar.** Se separó a propósito del resumen mensual por mail
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
lunes"). Falta decidir cuántos días — probablemente entre 3 y 7.

**Un movimiento que llega del outbox nunca se rechaza.** Si cae en un período ya bloqueado, se
acepta igual y se recalcula ese snapshot. Con la ventana, eso pasa a ser un evento raro y
detectable en vez de la operación normal — y conviene avisarle al usuario que ocurrió, en lugar de
ajustar el pasado en silencio.

La diferencia con no tener cierre no es que el recálculo desaparezca: es que deja de ser el caso
común y pasa a ser la excepción.

## Lo que hay que decidir cuando se diseñe

- **Cuántos días de gracia**, y si son configurables por hogar o fijos.
- **Qué ve el usuario** cuando intenta editar algo bloqueado. La respuesta no puede ser un error
  seco: tiene que ofrecer la conciliación, que es el camino correcto (`CLAUDE.md` — los errores
  proponen la corrección, no la nombran).
- **Si el bloqueo se aplica también al borrado.** Borrar un movimiento de un mes cerrado es
  equivalente a editarlo.
- **Qué pasa con un movimiento `pending` de cotización** que se resuelve después del cierre: eso
  cambia `amount_base` de un período cerrado, que es justamente lo que el cierre prohíbe. Es el caso
  borde más incómodo y hay que resolverlo de frente, no descubrirlo después.
- **Quién escribe los snapshots**: el mismo cron que manda los resúmenes, u otro.
- **Cómo se recalcula un snapshot** cuando llega algo tarde, y hasta dónde se propaga.

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
