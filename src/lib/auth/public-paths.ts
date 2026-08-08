/**
 * Rutas que no requieren sesión — el flujo que TE LLEVA a tener una
 * (onboarding, unirse a un household por invitación), más `/offline`
 * (la pantalla de error de A3) y `/api/fx` (valida su propia sesión adentro
 * del route handler, F3). `/dev` es el playground de componentes, sin datos
 * de usuario — igual que ya lo trata `OnboardingGate` del lado cliente.
 * `/about` es la página pública de marca, indexable y sin tab bar —
 * existe para que la "Application home page" de Google Auth Platform
 * apunte a algo que no sea un login (`docs/mejora-auth-oauth-y-email.md`
 * § 2, verificación de marca).
 *
 * `/login`, `/forgot-password` y `/reset-password` NO están acá a
 * propósito: son stubs de redirect de compatibilidad (CLAUDE.md § rutas,
 * la solución de transición de contraseñas se revirtió — ver
 * `docs/mejora-auth-oauth-y-email.md` § 0.1). Sin sesión, este chequeo ya
 * manda cualquier ruta no pública a `/onboarding` — el stub ni siquiera
 * llega a renderizar. Con sesión, el stub se monta y hace su propio
 * `redirect("/onboarding")`.
 *
 * Módulo separado de `proxy.ts` a propósito, sin depender de `@/env`: así
 * se puede testear el allowlist en sí sin mockear Supabase/NextRequest.
 */
/**
 * `/add` es público por tres razones que conviene no perder:
 *
 * 1. **No expone nada.** `src/app/add/page.tsx` es `"use client"` y no lee
 *    un solo dato de servidor: el HTML que se devuelve es el shell, idéntico
 *    para cualquier visitante. Saldos, cuentas y household salen de Dexie,
 *    en el cliente, después. RLS sigue intacta.
 * 2. **La captura ya está declarada pre-auth** (`CLAUDE.md`: el shortcut de
 *    la PWA, el share target, el widget y la notificación persistente entran
 *    directo al keypad sin pedir nada). Escribir no revela nada, leer sí.
 * 3. **Es la única forma de que el precache no se envenene.** El service
 *    worker se instala en la primera visita, que es `/start` o
 *    `/onboarding`, sin sesión. Si el proxy redirige `/add`, Serwist guarda
 *    esa redirección BAJO LA CLAVE `/add` — su
 *    `copyRedirectedCacheableResponsesPlugin` copia las respuestas
 *    redirigidas a propósito— y después la sirve cache-first, con prioridad
 *    sobre la red, hasta el próximo deploy. No se puede filtrar del lado
 *    del service worker: rechazar la respuesta hace que `_handleInstall`
 *    tire `bad-precaching-response` y falle la instalación entera. La
 *    respuesta correcta es que el servidor no redirija.
 *
 * La expulsión de quien no tiene sesión no desaparece, se mudó al cliente:
 * `src/app/add/page.tsx` redirige a `/onboarding` cuando hay red, y cuando
 * no la hay muestra un estado explicativo en vez de mandar a una ruta que
 * sin conexión no existe.
 */
const PUBLIC_PREFIXES = ["/onboarding", "/auth", "/join", "/offline", "/api/fx", "/dev", "/about", "/start", "/add"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
