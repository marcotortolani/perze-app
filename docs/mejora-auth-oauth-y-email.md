
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

## 0. Estado actual

La plantilla propia ya no es un `.html` escrito a mano: se genera desde
`src/emails/auth/{magic-link,recovery}.tsx` con react-email
(`docs/mejora-auth-oauth-y-email.md` § 5 y § 8) y trae el branding de
Perze — wordmark, tipografía, tokens de color en modo claro. Sigue
teniendo las mismas dos vías que antes: el código de 6 dígitos grande
(`{{ .Token }}`) y el botón "O continuá con un click", que apunta a
`/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
— **nunca `{{ .ConfirmationURL }}`**, que cae en el flujo implícito con
tokens en el fragment.

Pendiente, en este orden:

- [ ] **Resend como SMTP de Auth** — el paso de mayor valor, ver
  [§ 5](#5-resend--smtp-para-supabase-auth): el proveedor default solo
  entrega a miembros del proyecto y con tope de 2 mails/hora, así que hoy
  ningún usuario real puede recibir su código. Lo ejecuta el operador
  (Dashboard de Supabase + DNS de Resend), no es un cambio de código.
- [ ] **Pegar `supabase/templates/magic_link.html` y `recovery.html` en el
  Dashboard**: Authentication → Emails. `supabase config push` sigue
  rechazándolas en plan free con o sin SMTP propio; el editor del
  Dashboard sí las acepta. Los archivos se regeneran con
  `pnpm email:export` desde el TSX — nunca se editan a mano
  (`src/emails/auth/templates.test.ts` lo verifica).
- [ ] **Verificar el Site URL** en Authentication → URL Configuration: la
  plantilla usa `{{ .SiteURL }}` para armar el link y el wordmark, así que
  tiene que apuntar al dominio del deploy (con `http://localhost:3000` en
  la allowlist de redirects para seguir probando con `pnpm dev`).
- [ ] **Probar el ciclo completo con un mail ajeno al proyecto** una vez
  hecho lo anterior: registro → mail con branding → código tipeado **y**
  link clickeado → `/pending` → aprobación desde el panel del operador →
  onboarding. Las dos vías, no una — es la puerta de entrada a revertir
  la transición de contraseñas de § 0.1.

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

1. **El colapso de A2 — hecho.** `src/app/onboarding/page.tsx` ahora tiene
   un estado local `emailExpanded` (`false` con OAuth registrado, `true`
   sin él): con Google encendido el email queda detrás de un disparador de
   texto "Usar mi email" y aparece con foco automático al tocarlo, en vez
   de convivir siempre visible con los botones de proveedor. Clave i18n
   nueva `onboarding.auth.useMyEmail` en `messages/{es,en,pt}.json`, y
   `e2e/onboarding-oauth-collapse.spec.ts` cubre las dos ramas.
2. **Verificar el retorno en PWA instalada — pendiente, prueba manual.**
   `signInWithOAuth` navega el documento entero a Google; en modo
   standalone, el ida y vuelta hasta `/auth/callback` puede terminar en una
   pestaña del navegador del sistema en vez de la ventana instalada.
   Requiere Google ya configurado en el proyecto remoto ([§ 0](#0-estado-actual)
   de este documento) — no se puede probar solo con código.
3. **Confirmar que `?next=` sobrevive el viaje completo — pendiente,
   prueba manual.** `safeNextPath` (`src/lib/auth/safe-next-path.ts`) ya
   valida el destino; falta confirmar en la prueba end-to-end contra
   Google real que el parámetro efectivamente llega, que es lo que se
   rompe si falta el paso 6 de [§ 2](#2-google--configuración). Mismo
   motivo que el punto 2: `e2e/onboarding-first-expense.spec.ts` ya
   asume el botón de Google y falla hoy porque el provider todavía no
   está configurado en el Dashboard — no es una regresión de código.

## 5. Resend — SMTP para Supabase Auth

Es el cambio de mayor valor inmediato: destraba tres problemas ya activos.

**Por qué hace falta.** Hoy todo el mail de Auth sale por el proveedor
default de Supabase, que estaba limitado a **2 mails por hora** y, según la
documentación de Supabase, ese proveedor default **solo entrega a miembros
del equipo del proyecto** — no puede mandarle un OTP a un usuario real. Ese
límite fue justamente lo que frenó las pruebas de A2 registradas en
`docs/plan-de-trabajo.md:522`. Además, `supabase/templates/magic_link.html`
(ahora generado por react-email, ver [§ 8](#8-flujo-de-las-plantillas-de-auth-con-react-email))
**no se puede aplicar por `config push`**: `supabase config push` la
rechaza en plan free, con SMTP propio o sin él, y por eso el commit
`eea7061` tuvo que resolver la plantilla del OTP por otro camino primero.
El HTML se pega a mano en el Dashboard.

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
   hora** (ajustable después en Rate Limits). `supabase/config.toml` ya
   refleja ese valor — es documentación, no algo que este archivo
   configure: el rate limit real vive en el Dashboard del proyecto remoto.
5. `pnpm email:assets && pnpm email:export` genera
   `supabase/templates/{magic_link,recovery}.html` desde
   `src/emails/auth/*.tsx`. Pegar ambos en Authentication → Emails
   (Magic Link y Recovery) — **esto sigue siendo manual**, `config push`
   no lo aplica en plan free.

La API key de Resend es secreto de servidor: se carga solo en la
configuración SMTP de Supabase, nunca como `NEXT_PUBLIC_*` ni en el bundle
del cliente.

## 6. Resend — mails transaccionales de la app

Backlog de lo que hoy no existe y que Resend habilita. Alcance de esta
pasada: **solo el primer punto.**

- **Invitación al household (J3) — implementado.**
  `household_invites` guardaba una columna `email` que nadie usaba: el
  código se compartía a mano (`src/lib/repos/invites-repo.ts`,
  `src/app/(app)/family/invite/page.tsx`). Ahora, con email cargado,
  `/family/invite` manda el mail vía `src/app/api/emails/invite/route.ts`
  — ver [§ 8](#8-flujo-de-las-plantillas-de-auth-con-react-email) para el
  patrón general de plantillas y el detalle del handler.
- **Resumen semanal, alertas de presupuesto, recordatorios de recurrentes e
  insights — fuera de alcance, con motivo.** Las cuatro preferencias ya
  existen en `src/lib/repos/notification-preferences-repo.ts` con **un
  solo canal implementado, push**. Sumar email exige una migración de
  schema primero (`notification_preferences` es un booleano por tipo, sin
  noción de canal) y una decisión de producto que no se toma sola: **qué
  dispara cada aviso y con qué frecuencia** — `supabase/functions/send-push/index.ts`
  deja escrito en su cabecera que hoy nadie lo dispara, a propósito.
  Resend resuelve el transporte, no el disparador.
- **Confirmación de export de datos y de borrado de cuenta (K9) — fuera de
  alcance**, mismo criterio de priorización: no hay urgencia sin un
  disparador todavía definido.

**Dónde vive el envío — decisión cerrada: Route Handlers de Next, no una
Edge Function.** El envío disparado por el usuario (invitar a alguien) no
necesita `service_role` ni cron: corre con la sesión del usuario y RLS
como barrera de autorización, igual que `src/app/api/fx/route.ts`. Una
Edge Function tendría sentido recién para lo que dispare el *servidor* sin
que haya un usuario navegando (el resumen semanal, por ejemplo) — que es
justo lo que queda fuera de esta pasada. `src/emails/send.ts` envuelve el
SDK de Resend; el secreto se carga como `RESEND_API_KEY` en el entorno del
deploy de Next (bloque `server` de `src/env.ts`), nunca como
`NEXT_PUBLIC_*` ni en un secreto de Supabase — acá no hay Edge Function
que lo necesite.

## 7. Google + colapso de A2 — hecho

`NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS=google` enciende los botones que ya
estaban programados (`src/app/onboarding/page.tsx`). Lo que faltaba —el
colapso del email bajo "Usar mi email" que exige `CLAUDE.md` § "Orden de
A2"— está programado: sin la variable, A2 es idéntica a como era; con
ella, el email colapsa y el `Input` aparece recién al tocar el disparador,
con foco automático. Apple sigue sin dibujarse — la rama del código queda
intacta, ver [§ 3](#3-apple--descartado-y-por-qué).

Pendiente, y es prueba manual, no de código: instalar la PWA y confirmar
que el ida y vuelta de `signInWithOAuth` en modo standalone deja la sesión
en la ventana instalada, y que `?next=` sobrevive el viaje completo — se
rompe si falta el paso 6 de [§ 2](#2-google--configuración).

## 8. Flujo de las plantillas de Auth con react-email

Los tres emails de esta pasada (`magic_link`, `recovery`, invitación al
household) comparten el mismo sistema de branding en `src/emails/`:

- `src/emails/theme.ts` — los hexes del **modo claro** de
  `docs/02-design-system.md` (muchos clientes de mail ignoran
  `prefers-color-scheme`) y el stack tipográfico (`Inter`, no `Geist` —
  Geist está autohospedada bajo un hash de Next e inalcanzable desde un
  cliente de mail).
- `src/emails/components/{EmailLayout,EmailButton,Wordmark}.tsx` — el
  shell, el botón primario y el wordmark, como PNG absoluto (
  `scripts/generate-email-assets.mjs`, `pnpm email:assets`): un SVG no se
  renderiza de forma confiable en Gmail ni en Outlook.
- `src/emails/auth/{magic-link,recovery}.tsx` — las dos plantillas de
  Auth, **en español fijo** (el Dashboard de Supabase tiene una sola
  plantilla por tipo, sin noción de locale — ver el comentario de
  `src/emails/auth/copy.ts` para las dos alternativas evaluadas y
  descartadas). Emiten los placeholders Go (`{{ .Token }}`,
  `{{ .TokenHash }}`, `{{ .SiteURL }}`) **literales**, sin que React los
  escape — `src/emails/auth/templates.test.ts` lo verifica.
- `src/emails/invite.tsx` — la única plantilla con i18n real (ES/EN/PT vía
  next-intl), porque la manda la propia app y no GoTrue.

**Ciclo de edición:** tocar el `.tsx` → `pnpm email:export` (regenera
`supabase/templates/{magic_link,recovery}.html` desde el TSX con
`scripts/export-email-templates.mjs`, que bundlea con esbuild y renderiza
con `@react-email/render`) → commitear el HTML junto con el cambio →
pegarlo a mano en el Dashboard. El Dashboard es la fuente **efectiva**
mientras `supabase config push` siga rechazando plantillas en plan free;
el HTML commiteado es la fuente de verdad de lo que *debería* estar
pegado ahí, y el test de paridad byte a byte es lo que evita que diverjan.

**Preview:** `pnpm dev` + `/dev/emails` (solo fuera de producción, mismo
guardarraíl que el resto de `/dev`). No se instaló el CLI `react-email`:
levanta su propio servidor Next dentro del proyecto y arriesgaba
`pnpm build`.

## 9. Orden recomendado y costo

| Paso | Costo | Estado |
| --- | --- | --- |
| Plantillas de Auth con branding (react-email) | US$ 0 | Código listo — falta pegar en el Dashboard (config del operador) |
| Resend SMTP en Supabase Auth | US$ 0 | Config del operador — ver [§ 5](#5-resend--smtp-para-supabase-auth) |
| Google OAuth + colapso de A2 | US$ 0 | Código listo — falta la config de Google Cloud (operador) |
| Invitación al household por email | US$ 0 hasta 3.000/mes | Implementado |
| Reversión de la transición de contraseñas | código | Bloqueado hasta probar el OTP real con un mail ajeno al proyecto — ver § 0.1 |
| Resumen semanal, alertas, K9 | US$ 0 hasta 3.000/mes | Fuera de alcance — falta migración de canal y decisión de disparador |

Apple queda fuera de alcance por decisión, no por orden de prioridad — ver
[§ 3](#3-apple--descartado-y-por-qué). Todo el camino de esta tabla cuesta
US$ 0 recurrentes.
