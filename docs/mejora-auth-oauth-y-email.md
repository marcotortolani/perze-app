# Mejora: Google OAuth + Resend para email

> Este documento **no es especificación de producto** y no entra en la cadena
> de autoridad de `CLAUDE.md`. Es un runbook de configuración externa más un
> backlog de código para dos mejoras concretas: encender el login con Google
> y reemplazar el proveedor de mail default de Supabase por Resend. Nada de
> lo que dice acá contradice `docs/design/` ni el contrato de componentes —
> si algo entra en conflicto, gana lo que ya dice `CLAUDE.md`.

## Por qué existe este documento

La pregunta que lo originó fue "¿qué pasó con el acceso con Google o Apple,
que estaba en el diseño original?". La respuesta corta es que **no se sacó
nada**: el login con Google y Apple ya está programado en el código, apagado
por falta de credenciales. Ver [§ 1](#1-estado-actual-por-qué-esto-no-es-un-bug).

En paralelo apareció un problema real y sin relación directa: todo el email
de la app hoy sale por el proveedor default de Supabase, que tiene un límite
de 2 mails por hora y no entrega a usuarios reales. Resend en plan gratuito
resuelve eso y de paso habilita mails que la app todavía no manda (invitación
al household, resumen semanal). Ver [§ 5](#5-resend--smtp-para-supabase-auth)
y [§ 6](#6-resend--mails-transaccionales-de-la-app).

## 0. Pendientes inmediatos — retomar por acá

Quedaron de la sesión del 2026-08-01 que arregló el login por el link del
mail (v0.6.1). El código de la app ya no depende de ninguno de estos pasos
para funcionar — el link del mail default ya inicia sesión de verdad — pero
los dos primeros mejoran el mail en sí y el tercero destraba usuarios
reales:

- [ ] **Pegar la plantilla propia en el Dashboard**: Authentication →
  Emails → *Magic Link*, con el contenido de
  `supabase/templates/magic_link.html`. `supabase config push` la rechaza
  en plan free, pero el editor del Dashboard sí la acepta. La plantilla
  actual ya trae las dos vías: el código de 6 dígitos grande ({{ .Token }})
  y el botón "O continuá con un click", que apunta a
  `/auth/callback?token_hash={{ .TokenHash }}&type=email` — un route que la
  app ahora sí consume server-side. **Nunca volver a {{ .ConfirmationURL }}**:
  ese termina en el flujo implícito con tokens en el fragment, que A2
  tolera solo como red de seguridad.
- [ ] **Verificar el Site URL** en Authentication → URL Configuration: la
  plantilla usa `{{ .SiteURL }}` para armar el link, así que tiene que
  apuntar al dominio del deploy (con `http://localhost:3000` en la
  allowlist de redirects para seguir probando con `pnpm dev`).
- [ ] **Resend como SMTP de Auth** — el paso de mayor valor, ver
  [§ 5](#5-resend--smtp-para-supabase-auth): el proveedor default solo
  entrega a miembros del proyecto y con tope de 2 mails/hora, así que hoy
  ningún usuario real puede recibir su código.
- [ ] **Probar el ciclo completo con un mail ajeno al proyecto** una vez
  hecho lo anterior: registro → mail → código tipeado Y link clickeado →
  `/pending` → aprobación desde el panel del operador → onboarding.

## 0.1 Solución de transición: registro con contraseña, `/login`, `/forgot-password`

> **Esto es temporal y contradice el diseño a propósito.** No se toca de
> nuevo por accidente — se revierte en un solo movimiento cuando este
> documento haya resuelto Google Auth (§ 2) y Resend con plantilla propia
> (§ 5), momento en el que el flujo real vuelve a ser el que ya describen
> `docs/design/bloque-a-onboarding.html` (A2/A3/A4) y `CLAUDE.md`: **sin
> contraseñas, ni acá ni nunca**, login y signup indistinguibles en A2.

El 2026-08-02 el link del mail seguía sin funcionar en producción — GoTrue
devolvía `?code=...` a la raíz del sitio y `src/proxy.ts` lo descartaba
antes de canjearlo (fix aparte, ver el commit que acompaña este cambio).
Mientras ese fix no se probaba en un mail real y no había ni plantilla
propia (§ 0, bloqueada en plan free) ni el operador de la instancia podía
entrar (contraseña nunca fijada), se agregó una vía de acceso adicional:

- **`/onboarding/register`** — destino del link ya canjeado. Pide nombre y
  contraseña (con confirmación); el email queda fijo, tomado de la sesión.
  País y moneda siguen siendo A4 (`/onboarding/country`), sin duplicar nada.
- **`/login`** — email + contraseña, para quien ya se registró. `src/proxy.ts`
  y `OnboardingGate` deciden entre esta pantalla y `/onboarding` con la
  cookie `perze_registered` (`src/lib/auth/registered-cookie.ts`).
- **`/forgot-password` → `/reset-password`** — dispara
  `resetPasswordForEmail` (tipo `recovery`, mismo canje en
  `auth/callback/route.ts` que ya sabía manejar `token_hash`/`code`) y
  define la contraseña nueva.
- El código de 6 dígitos (A3) **no se borró**: queda detrás de
  `NEXT_PUBLIC_AUTH_OTP_CODE` (default apagado), listo para reactivarse
  cuando haya plantilla de mail con código propio.

**Al volver al flujo de diseño**, hay que: apagar/borrar `/login`,
`/onboarding/register`, `/forgot-password`, `/reset-password`; borrar la
cookie `perze_registered` y su lectura en `proxy.ts`/`OnboardingGate`;
quitar el `emailRedirectTo` a `/onboarding/register` de `signInWithOtp` (que
vuelve a apuntar donde corresponda una vez que el link haga login/signup
directo); y decidir si `profiles.registration_completed_at` se elimina en
una migración nueva o se deja de escribir sin más (es append-only, no se
edita la migración que la creó).

## 1. Estado actual (por qué esto no es un bug)

`CLAUDE.md` § "Orden de A2" cierra una decisión de producto: la pantalla de
login tiene **dos estados**, no dos diseños. Con proveedores OAuth
registrados, Google y Apple son los botones primarios y el campo de email
colapsa bajo "usar mi email". Sin proveedores registrados, el email es el
campo primario y los botones de Google/Apple **no se dibujan** — ausentes, no
deshabilitados, porque un botón muerto sin credenciales se lee como una app
rota.

El código ya implementa las dos ramas:

- `src/app/onboarding/page.tsx:25-28` filtra
  `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` (una CSV `"google,apple"`) y solo deja
  pasar esos dos valores.
- `src/app/onboarding/page.tsx:41-48` (`handleOAuth`) ya llama a
  `supabase.auth.signInWithOAuth`.
- `src/app/onboarding/page.tsx:97-114` renderiza los botones condicionados a
  esa lista.
- `src/app/auth/callback/route.ts` hace el intercambio PKCE completo
  (`exchangeCodeForSession`) y respeta `?next=` vía `safeNextPath`. Desde
  v0.6.1 también verifica server-side los links
  `?token_hash=...&type=email` del mail de verificación.
- `src/env.ts:27-30` declara la variable en el contrato de entorno.
- `.env.example` la documenta, comentada por defecto.
- Los íconos `google` y `apple` ya existen en
  `src/design-system/core/Icon.tsx:119-120`.
- Las claves i18n `onboarding.auth.continueWithGoogle`,
  `continueWithApple` y `orWithEmail` ya están en
  `messages/{es,en,pt}.json`.

Hoy `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` está sin definir en `.env.local`, así
que la app corre en la rama "sin OAuth" — que es la rama correcta para un
self-host que todavía no registró las apps en ningún proveedor. Prender
Google es, en el código de la app, **cambiar una sola variable de entorno**.

## 2. Google — configuración

Sin costo recurrente. Pasos en orden:

1. En [Google Cloud Console](https://console.cloud.google.com/auth/clients),
   crear un **OAuth client ID** de tipo **Web application**.
2. **Authorized JavaScript origins**: el dominio del deploy de producción
   (`https://tu-dominio.com`) y `http://localhost:3000` para desarrollo.
3. **Authorized redirect URIs**: el callback del proyecto de Supabase,
   `https://<project-ref>.supabase.co/auth/v1/callback`. El `project-ref` es
   el que ya usa `NEXT_PUBLIC_SUPABASE_URL`; también está en el dashboard, en
   Authentication → Providers → Google.
4. Completar la **pantalla de consentimiento OAuth**: nombre de la app, logo,
   links de política de privacidad y términos. La verificación de marca de
   Google puede tardar varios días hábiles; sin verificar, los usuarios ven
   un aviso de "app no verificada" antes de continuar — tolerable en
   desarrollo, no en producción. Es un plazo a planificar, no un paso
   opcional.
5. En Supabase Dashboard → Authentication → Providers → **Google**: pegar el
   client ID y el client secret generados, y habilitar el provider.
6. En Supabase Dashboard → Authentication → **URL Configuration → Redirect
   URLs**: agregar `<origin>/auth/callback` (por ejemplo
   `https://tu-dominio.com/auth/callback`). Este paso es el que más se
   olvida: si el `redirectTo` que manda `page.tsx:45` no está en esta
   allowlist, Supabase lo descarta en silencio y redirige al Site URL por
   defecto — el `?next=/onboarding/country` se pierde sin ningún error
   visible en la app.
7. En `.env.local` y en las variables de entorno del deploy:

   ```bash
   NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS=google
   ```

   Es el único cambio del lado de la app.

## 3. Apple — descartado, y por qué

Esta es una decisión cerrada, no un pendiente. Se deja documentada acá para
que quien abra `docs/design/bloque-a-onboarding.html` y vea el botón "Apple"
en A2 no lo lea como un olvido y lo "restaure".

Motivos:

- **Cuesta US$ 99/año** de Apple Developer Program. No existe un camino
  gratuito para Sign in with Apple en web.
- **El client secret caduca cada 6 meses** y hay que regenerarlo a mano
  desde la clave `.p8` guardada. Si se pasa la fecha, el login con Apple
  rompe en silencio para todos los usuarios de Apple hasta que alguien lo
  note — mantenimiento recurrente sobre un proyecto personal.
- **Cobertura marginal frente a Google.** Prácticamente todo el mundo tiene
  cuenta de Google; quien no la tiene ya cuenta con el camino de email, que
  funciona hoy.
- **"Ocultar mi correo"** de Apple entrega una dirección de relay
  `@privaterelay.appleid.com`, que rompería el matcheo de invitaciones por
  email de `household_invites.email` (`src/lib/repos/invites-repo.ts`): el
  código de invitación se manda a un mail que la persona invitada puede no
  reconocer como propio.

Para una PWA no hay ninguna obligación de ofrecer Sign in with Apple: esa
regla aplica a apps de la App Store que ya ofrecen otro social login, no a la
web.

**Consecuencia sobre el código: ninguna, a propósito.** La rama de Apple en
`page.tsx:102-106` y el filtro de `OAUTH_PROVIDERS` (`page.tsx:25-28`) quedan
como están. Con la variable de entorno en `google` (sin `apple`), el botón
de Apple simplemente no se dibuja — que es exactamente el estado que exige
la decisión de A2 para un proveedor no registrado. Borrar ese código sería
trabajo para volver a escribirlo si algún día se paga la cuenta.

## 4. Cambios de código pendientes

Tres, para ejecutar en una pasada futura — no se implementan en este
documento:

1. **El colapso de A2 no está programado.** La decisión cerrada dice que con
   OAuth registrado el email colapsa bajo "usar mi email". El código de hoy
   (`page.tsx:108-119`) siempre muestra el divisor y el `Input` de email
   visible. No se nota mientras `OAUTH_PROVIDERS` está vacío; el día que se
   encienda Google, la pantalla queda distinta de la decisión cerrada.
   Requiere un estado local de "email expandido" y una clave i18n nueva
   (`onboarding.auth.useMyEmail`) en `messages/{es,en,pt}.json` — cero
   strings hardcodeadas, como manda `CLAUDE.md`.
2. **Verificar el retorno en PWA instalada.** `signInWithOAuth` navega el
   documento entero a Google; en modo standalone, el ida y vuelta hasta
   `/auth/callback` puede terminar en una pestaña del navegador del sistema
   en vez de la ventana instalada. Es un caso a **probar**, no a asumir roto
   ni asumir sano — instalar la PWA y confirmar dónde queda la sesión.
3. **Confirmar que `?next=` sobrevive el viaje completo.** `safeNextPath`
   (`src/lib/auth/safe-next-path.ts`) ya valida el destino; falta confirmar
   en la prueba end-to-end que el parámetro efectivamente llega, que es lo
   que se rompe si falta el paso 6 de [§ 2](#2-google--configuración).

## 5. Resend — SMTP para Supabase Auth

Es el cambio de mayor valor inmediato: destraba tres problemas ya activos.

**Por qué hace falta.** Hoy todo el mail de Auth sale por el proveedor
default de Supabase, que en `supabase/config.toml:207-209` está limitado a
**2 mails por hora** y, según la documentación de Supabase, ese proveedor
default **solo entrega a miembros del equipo del proyecto** — no puede
mandarle un OTP a un usuario real. Ese límite fue justamente lo que frenó
las pruebas de A2 registradas en `docs/plan-de-trabajo.md:522`. Además,
`supabase/templates/magic_link.html` ya está escrito y **no se puede
aplicar**: `supabase config push` la rechaza en plan free
(`supabase/config.toml:282-289`), y por eso el commit `eea7061` tuvo que
resolver la plantilla del OTP por otro camino.

**Límites del plan gratuito de Resend** (verificado en
[resend.com/pricing](https://resend.com/pricing)): 3.000 mails por mes, tope
de **100 por día**, 1 dominio verificado, 30 días de retención de datos. Para
un household familiar con OTP de login más un resumen semanal sobra de
sobra; el techo que importa vigilar es el diario, no el mensual.

**Setup:**

1. Crear cuenta en Resend y **verificar un dominio propio** (registros DKIM
   vía CNAME, SPF vía TXT y DMARC en el DNS del dominio). Sin dominio propio
   solo se puede mandar desde `onboarding@resend.dev` y únicamente al mail
   de la propia cuenta de Resend — sirve para probar el flujo, no para
   producción.
2. Generar una API key en el dashboard de Resend.
3. En Supabase Dashboard → Authentication → **SMTP Settings**:

   | Campo | Valor |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Puerto | `587` |
   | Usuario | `resend` |
   | Contraseña | la API key de Resend |
   | Remitente | una dirección del dominio verificado |

4. Al activar SMTP propio, Supabase eleva el límite inicial a **30 mails por
   hora** (ajustable después en Rate Limits). Actualizar
   `supabase/config.toml:209` para que el archivo refleje el límite real.
5. Recién con SMTP propio activo se puede descomentar
   `[auth.email.template.magic_link]`
   (`supabase/config.toml:287-289`) y correr `supabase config push` sin que
   lo rechace — `supabase/templates/magic_link.html` ya está listo y
   esperando ese paso.

La API key de Resend es secreto de servidor: se carga solo en la
configuración SMTP de Supabase, nunca como `NEXT_PUBLIC_*` ni en el bundle
del cliente.

## 6. Resend — mails transaccionales de la app

Backlog priorizado de lo que hoy no existe y que Resend habilitaría, cada uno
con el archivo que lo tocaría:

- **Invitación al household (J3).** `household_invites` ya guarda una
  columna `email` que **nadie usa hoy** — el código de invitación se
  comparte a mano (`src/lib/repos/invites-repo.ts`,
  `src/app/(app)/family/invite/page.tsx`). Es el hueco más evidente y el
  mejor primer caso de uso.
- **Resumen semanal, alertas de presupuesto, recordatorios de recurrentes e
  insights.** Las cuatro preferencias ya existen en
  `src/lib/repos/notification-preferences-repo.ts` con **un solo canal
  implementado, push**. Email es particularmente relevante porque en iOS el
  Web Push exige la PWA instalada — sin eso, esos avisos hoy no llegan por
  ningún lado.
- **Confirmación de export de datos y de borrado de cuenta (K9).**

Dos puntos que son **decisión pendiente, no detalle de implementación**:

- `notification_preferences` es un booleano por tipo de aviso, **sin noción
  de canal**. Sumar email pide una migración de schema (una columna de canal
  por tipo, o una segunda columna paralela por tipo) — no se resuelve solo
  con código de envío.
- `supabase/functions/send-push/index.ts` deja escrito en su cabecera que
  **nadie lo dispara todavía**, a propósito: la frecuencia y el disparador
  de cada tipo de notificación son decisión de producto que no se toma sola.
  El mismo pendiente aplica igual a email — Resend resuelve el transporte,
  no el disparador.

**Dónde vive el envío.** Una Edge Function nueva, hermana de `send-push`,
reusando su mismo patrón: validación del request con Zod, `service_role`
para leer `notification_preferences`, respuesta opaca vía el helper
`internalError` (nunca se devuelve `error.message` de Postgres al
invocador), y sin CORS porque es server-to-server. El secreto se carga con
`supabase secrets set RESEND_API_KEY=...`, igual que `VAPID_PRIVATE_KEY` hoy.

## 7. Orden recomendado y costo

| Paso | Costo | Destraba |
| --- | --- | --- |
| Resend SMTP en Supabase Auth | US$ 0 | OTP a usuarios reales, 30/h en vez de 2/h, plantilla propia |
| Google OAuth | US$ 0 | El p90 de 90 s de A2 |
| Colapso de A2 + prueba en PWA | código | Que A2 coincida con la decisión cerrada |
| Mails transaccionales | US$ 0 hasta 3.000/mes | Invitaciones, avisos sin push en iOS |

Apple queda fuera de alcance por decisión, no por orden de prioridad — ver
[§ 3](#3-apple--descartado-y-por-qué). Todo el camino de esta tabla cuesta
US$ 0 recurrentes.
