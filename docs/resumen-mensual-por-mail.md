# Resumen por mail: mensual y anual

Diseño cerrado, sin implementar. Decisiones tomadas con Marco el 10 de agosto de 2026.

## Qué es

Un mail automático con el resumen del período que acaba de cerrar, y otro anual. Nada más: sin
push, sin IA, sin resumen semanal.

**El disparador es el cierre del período de cada hogar**, no el 1° de cada mes. El día de cierre se
configura por household (`households.period_start_day`) y no todos cierran el 1. Mandar el 1° haría
que el mail no coincida con lo que la app muestra como "este mes", que es el error más fácil de
cometer acá.

## Por qué se descartó lo demás

**Push para recordar funcionalidades: descartado.** El push es el canal más caro en confianza, y una
app de finanzas que notifica para promocionarse a sí misma se desinstala. Lo que hay hoy está bien.

**IA sobre los datos: descartado.** Mandar datos financieros a un modelo de terceros es una decisión
de privacidad que hay que tomar de frente, no de costado — y en un proyecto que se libera como open
source, quien haga self-host tendría que poder apagarla. Además hay un límite duro: un comentario
sobre patrones de gasto está bien, una recomendación de inversión no, y un modelo suelto las produce
sin que se las pidan.

**Frecuencia semanal o quincenal: descartada.** Un mail por mes es útil; uno por semana es invasivo.
Y tenía un problema de diseño: el hogar solo define el cierre mensual, así que el semanal habría
tenido que anclarse a algo inventado.

**Reutilizar la preferencia `weekly_summary`: descartado.** Se agrega una preferencia propia. Pero
hay que resolver que `weekly_summary` **hoy promete algo que no ocurre** — es un toggle en
`/more/notifications` sin ningún envío implementado, ni push ni mail. Se retira de la UI en el mismo
movimiento.

## Arquitectura

**La Edge Function lee, Next calcula y envía.**

```text
pg_cron (diario)
  └─ public.trigger_monthly_summaries()      -- SQL, mismo patrón que trigger_daily_fx_sync
       └─ Edge Function `monthly-summary`     -- Deno, service_role: SOLO lee filas visibles
            └─ POST /api/emails/monthly-summary  -- Next: calcula + React Email + next-intl + Resend
```

El motivo del salto extra: `CLAUDE.md` permite `service_role` **solo en Edge Functions y cron**, y
un route handler de Next no está en esa lista. Pero los mails que manda la app se renderizan con
React Email y next-intl (así sale la invitación al hogar, en ES/EN/PT), y eso no corre en Deno.
Partirlo en dos respeta las dos restricciones: los datos se leen donde corresponde, el mail se arma
donde ya está el diseño y los idiomas.

La ruta de Next se protege con un secreto compartido en header (`MONTHLY_SUMMARY_SECRET`), verificado
antes de hacer nada. No recibe ids de hogar ni consulta la base: recibe **las filas que ese miembro
puede ver**, ya filtradas por visibilidad del otro lado, y las convierte en el resumen con
`buildMonthlySummary()`. Aunque el secreto se filtrara, quien lo tenga puede mandarse mails con
números inventados; no puede leer datos de nadie.

## Dónde vive el cálculo, y por qué

La Edge Function corre en Deno y no puede importar de `src/`. Se evaluaron cuatro caminos.

**Duplicar la agregación en Deno — descartado.** Es el precedente del proyecto: `daily-fx-sync`
dice que son "los mismos proveedores que `src/lib/fx/providers/*.ts`, portados a Deno". Pero el
comentario de ese mismo archivo registra cómo terminó: su set de monedas soportadas **tenía 14
cuando el del cliente tenía 30**, así que el cron no precargó cotizaciones para 16 monedas durante
un tiempo, y nadie se enteró hasta que alguien fue a mirar.

Eso era una lista de códigos de tres letras. Acá habría que duplicar la clasificación de signo por
`kind`, la exclusión de `needs_fx`, la reconstrucción de saldos por efectos y la separación
consumo/liquidez. Si una lista se desincronizó, esto se desincroniza seguro — y el modo de falla es
un mail cuyos números no coinciden con la app, que nadie reporta como bug: se lee como que la app
miente.

**Todo en una función de Postgres — descartado.** Dejaría el filtrado pegado a `can_see_as`, pero no
elimina la duplicación: la mueve. La regla de signo por `kind` pasaría a existir en `cash-flow.ts`
**y** en SQL, en el lenguaje donde es más difícil de testear y donde las migraciones son
append-only.

**Compartir el TypeScript con un import map de Deno — descartado.** Técnicamente plausible (los
módulos son puros y los tipos desaparecen en runtime), pero acopla el deploy de la Edge Function a
que nadie agregue nunca un import de React o de Next en esa cadena de archivos. Falla ruidosamente,
que es mejor que en silencio, pero es una restricción invisible que alguien va a romper sin saber
que existía.

**Elegido: la Edge Function no calcula nada.** Su único trabajo es leer las filas que ese miembro
puede ver —SQL, `service_role`, `can_see_as`— y pasárselas a la ruta de Next, que ya corre el código
de la app. Toda la lógica de dinero queda en un solo lugar, en TypeScript, ya testeada.

**Excepción, decidida aparte:** el saldo de apertura y el de cierre de cada cuenta **se calculan en
Postgres**, no
en Next. Reconstruirlos en TypeScript exige *toda* la historia de la cuenta (`accountBalanceAt` suma
efectos desde `opening_balance`), así que el payload crecería con los años de uso. Una agregación
en SQL devuelve dos números por cuenta —apertura y cierre— y a Next viajan solo los movimientos del
período.

El cierre sale de ahí también, y no de "apertura + lo que pasó en el período": una cuenta abierta en
medio del período tiene apertura 0 —antes de `opening_date` no existía— y un cierre que sí incluye
su `opening_balance`. Sumarle los efectos a la apertura la dejaría corta por exactamente ese monto.

El costo es que la regla de "qué cuenta mueve cada `kind` y por cuánto" gana un equivalente en SQL:
es una regla chica y estable comparada con toda la agregación, es espejo declarado de
`computeTransactionEffects()` (`src/lib/repos/balance-effects.ts`), y queda fijada en
`supabase/tests/database/28_monthly_summary.sql` con saldos calculados a mano según ese módulo.

La alternativa —poblar `account_balance_snapshots`, que ya existe y está vacía— quedó documentada
aparte en `docs/cierre-de-periodo.md`: no se puede hacer bien mientras el pasado sea editable.

## Una limitación que el mail no debe negar

**El resumen se calcula sobre lo que llegó al servidor.** Si alguien tiene movimientos sin
sincronizar en su outbox, el mail no los incluye. No es un bug de esta funcionalidad: es la
consecuencia de que la app sea local-first, y aplica a cualquiera de los cuatro caminos de arriba.
El mail no debería afirmar una completitud que no tiene.

## Schema

Una migración nueva, append-only.

### `notification_preferences`

```sql
ALTER TABLE notification_preferences
  ADD COLUMN monthly_summary_email boolean NOT NULL DEFAULT true;
```

`weekly_summary` **no se borra** (append-only; y hay filas que la usan como default). Se deja de leer
desde la UI y se documenta como muerta.

### `summary_emails_sent`

Idempotencia: el cron puede reintentar, y dos mails del mismo resumen es una falla visible para el
usuario.

```sql
CREATE TABLE summary_emails_sent (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('monthly', 'annual')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, profile_id, kind, period_start)
);
```

RLS: habilitada en la misma migración. Lectura solo de las filas propias (`profile_id = auth.uid()`),
escritura solo `service_role`. Nadie del cliente escribe acá.

El `UNIQUE` es la garantía real: si el cron corre dos veces, el segundo insert falla y no se manda
nada. No alcanza con chequear antes de mandar — hay carrera.

## Qué dice el mail

Corto. Un mail de resumen que hay que scrollear no se lee.

- Período, con las fechas reales del hogar.
- Ingresos, egresos y balance del período.
- Comparación contra el período anterior (variación, no un gráfico).
- Las 3–5 categorías de mayor gasto.
- **Conteo de movimientos excluidos por falta de cotización**, si los hay. No es opcional:
  `CLAUDE.md` obliga a que todo agregado declare su exclusión, y un mail con un total que parece
  completo y no lo es es peor que no mandarlo.
- Un link a la app.

**Sin gráficos.** Los clientes de correo los rompen y obligan a imágenes generadas del lado servidor.

**El resumen anual** es el mismo cuerpo sobre los 12 períodos cerrados, más el total del año y el
mes de mayor gasto. Sale con el cierre del período que completa el año calendario del hogar.

## Privacidad: la parte delicada

**Un mail por miembro, no uno por hogar.** En un grupo familiar hay movimientos privados
(`visibility`) y excepciones (`visibility_grants`). Los números de cada mail tienen que estar
calculados con lo que **ese miembro** puede ver, usando el helper `can_see()` que ya existe.

Mandar un mail con el total del hogar a todos los miembros filtraría por correo justo lo que la app
oculta en pantalla. Es el modo de falla más caro de esta funcionalidad y el que hay que testear
primero.

El email sale de `auth.users.email` (no vive en `profiles`), accesible con `service_role` desde la
Edge Function.

## Orden de implementación

Los pasos 1 a 4 están hechos. Lo que existe hoy:

- `src/lib/analytics/period-summary.ts` (`expenseByCategory`, `comparePeriods`) y
  `period-balances.ts` (`accountBalanceAt`, `periodAccountBalances`, `investingActivity`).
- `src/lib/analytics/monthly-summary.ts` — la composición, con sus unitarios.
- `src/emails/monthly-summary.tsx` — la plantilla, en ES/EN/PT.
- `src/app/api/emails/monthly-summary/route.ts` — recibe filas, calcula, renderiza y manda.
- `supabase/migrations/20260810090000_monthly_summary_read.sql` — `summary_transactions()` y
  `summary_account_balances()`, con `supabase/tests/database/28_monthly_summary.sql`.
- `supabase/functions/monthly-summary/index.ts` — lee por miembro y postea.

Falta el paso 5 (migración de preferencia + `summary_emails_sent` + cron) y el 6 (la preferencia en
`/more/notifications`).

1. **El cálculo, puro y testeado.** Una función que dado (household, profile, período) devuelve el
   resumen ya filtrado por visibilidad. Sin red, sin mail, sin cron. Es donde vive el riesgo real y
   se puede cubrir entero con tests — incluida la exclusión por `needs_fx` y el filtrado por
   visibilidad con un hogar de dos miembros y movimientos privados.
2. **La plantilla del mail** con React Email, en los tres idiomas, visible en `/dev/components`.
3. **La ruta de Next** con el secreto compartido, que recibe números y manda por Resend.
4. **La Edge Function**, que lee con `service_role`, llama al cálculo y postea a la ruta.
5. **La migración y el cron** al final, cuando lo de arriba ya funciona y el schema no se va a mover.
6. **La preferencia en `/more/notifications`**, y retirar el toggle de resumen semanal.

## Cosas que van a morder

- **El período del hogar no es el mes calendario.** Todo cálculo tiene que salir del helper de
  períodos que ya existe, nunca de `date_trunc('month')`.
- **Hogares sin movimientos en el período.** No mandar un mail vacío.
- **Miembros sin email verificado** o que se fueron del hogar entre el cierre y el envío.
- **Zona horaria**: el cierre es un día calendario del hogar, y las fechas se guardan en UTC. Vale la
  misma regla que el resto de la app — mediodía UTC para fechas sintetizadas, nunca medianoche.
- **El corte del período es UTC, y la app lo dibuja en el huso del dispositivo.** El hogar no guarda
  huso horario (decisión cerrada: se lee el del sistema operativo al renderizar), así que del lado
  servidor no hay otro corte defendible. Consecuencia real y aceptada: un movimiento cargado el
  último día del período después de las 21:00 en UTC-3 cae, para el mail, en el período siguiente.
  Son horas en el borde, no un desfase general. **El corte tiene que ser el mismo en los tres
  lugares** —la consulta SQL, la Edge Function y el recorte de la ruta de Next—: si uno corre un día,
  el recorte de Next tira filas que sí viajaron y el mail sale con menos plata que la pantalla.
  Cuando exista huso por hogar, se cambia en un solo lugar (los límites que arma el cron).
- **Resend puede fallar.** El insert en `summary_emails_sent` va DESPUÉS del envío exitoso, o un
  fallo de red deja a alguien sin resumen para siempre.
