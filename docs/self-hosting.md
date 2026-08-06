# Self-hosting PERZE

PERZE es local-first: la app misma no tiene backend propio más allá de Supabase (Postgres +
Auth + Storage). Correrla vos mismo significa: un proyecto de Supabase (propio o cloud) más un
deploy de este repo Next.js.

## 1. Creá tu proyecto de Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (el free tier alcanza para uso
   personal/familiar) o levantá tu propio stack de self-host de Supabase — ver la
   [documentación oficial de self-hosting de Supabase](https://supabase.com/docs/guides/self-hosting),
   que trae su propio `docker-compose.yml` (no se bundlea en este repo).
2. Instalá el [CLI de Supabase](https://supabase.com/docs/guides/cli) y logueate:

   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   ```

3. Aplicá el schema completo (todas las migraciones en `supabase/migrations/`):

   ```bash
   supabase db push --linked
   ```

   > **Nota:** las migraciones se escriben a mano a partir de `docs/01-arquitectura-datos.md`,
   > no se generan por diff. `supabase db diff`/`db pull` sin `--linked` no aplican acá.

4. (Opcional) Si vas a usar notificaciones push (K12), desplegá la Edge Function:

   ```bash
   supabase functions deploy send-push
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:vos@tudominio.com
   ```

   Generá tu propio par de claves VAPID (por ejemplo con `web-push generate-vapid-keys` o
   cualquier generador de claves EC P-256) — no reutilices las de otro deploy.

5. Desplegá la Edge Function de cotizaciones diarias (E20 — sin esto, `fx_rates` queda vacía
   para siempre):

   ```bash
   supabase functions deploy daily-fx-sync
   ```

6. Los cron jobs de `20260801160000_cron_engines.sql` (materializar recurrentes, cerrar
   resúmenes de tarjeta vencidos, purgar `audit_log`, podar `push_subscriptions`) quedan
   activos apenas se aplica la migración — no necesitan ningún paso más. Los dos que además
   llaman a una Edge Function (`daily-fx-sync` y el disparador de notificaciones hacia
   `send-push`) sí necesitan que registres dos secrets en **Vault** (Settings → Vault en el
   dashboard, o `select vault.create_secret(...)` por SQL) — sin ellos, esos dos cron jobs
   corren igual pero salen en silencio sin hacer nada, no fallan:

   | Nombre del secret            | Valor                                                    |
   | ----------------------------- | --------------------------------------------------------- |
   | `perze_project_url`           | `https://TU_PROJECT_REF.supabase.co`                      |
   | `perze_service_role_key`      | La `service_role` key — **Settings → API** en el dashboard |

   > **Por qué Vault y no una variable de entorno:** estas funciones SQL corren dentro de
   > Postgres (llamadas por `pg_cron`), no en la app ni en una Edge Function — no tienen
   > acceso a `.env`. Vault es el lugar donde Supabase guarda secretos que un `SECURITY
   > DEFINER` puede leer sin que RLS ni un cliente autenticado los vea nunca.

   La notificación de tipo `insights` (detección de anomalías) no se dispara sola: no hay un
   motor de detección del lado servidor todavía — queda como feature pendiente, no como bug.

7. (Opcional) Avisos por mail al operador cuando alguien nuevo pide acceso. Necesita, además de
   los dos secrets de Vault del punto 6 (`handle_new_user()` es quien dispara el aviso), sus
   propios secrets de Edge Function con las credenciales de Resend:

   ```bash
   supabase functions deploy notify-access-request
   supabase secrets set RESEND_API_KEY=... EMAIL_FROM=notificaciones@tudominio.com SITE_URL=https://tudominio.com
   ```

   Son las mismas credenciales de Resend que usa el mail transaccional de la app (§ 6 de
   `docs/mejora-auth-oauth-y-email.md`), pero cargadas **acá también** — los secrets de Edge
   Function y las variables de entorno de Next.js son dos lugares separados, aunque el valor
   sea el mismo. Sin estos dos secrets, el alta funciona igual — el mail simplemente no sale.

## 2. Variables de entorno

Copiá `.env.example` a `.env.local` (desarrollo) o cargalas como variables de entorno reales
en tu plataforma de deploy:

```bash
cp .env.example .env.local
```

Completá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` desde
**Settings → API** en el dashboard de tu proyecto. Las demás son opcionales — ver los
comentarios de `.env.example`.

## 3. Desarrollo local

```bash
pnpm install
pnpm dev
```

Abre en `http://localhost:3000`. No hace falta Docker para desarrollo: Supabase se usa contra
tu proyecto remoto (local o cloud), enlazado con `supabase link`.

## 4. Deploy en producción

### Opción A — Vercel (o cualquier plataforma que soporte Next.js)

Conectá el repo, configurá las mismas variables de entorno de `.env.example` en el dashboard
de la plataforma, y deployá. `pnpm build && pnpm start` es el comando estándar.

### Opción B — Docker

```bash
docker compose up --build
```

Con las variables de `.env.example` exportadas en tu shell o en un `.env` que Docker Compose
lea automáticamente. **No probado contra un build real en el entorno donde se escribió este
repo** (esa máquina de desarrollo no tiene Docker instalado, ver `CLAUDE.md`) — revisá el
`Dockerfile` antes de confiar en él para producción, especialmente si el build de Next.js
cambia de versión.

## 5. Datos de ejemplo

No hay un dataset de seed con datos ficticios para self-host — el onboarding (`/onboarding`)
te lleva por el flujo real de creación del primer household y la primera cuenta. Si querés
explorar la app con datos de prueba antes de cargar los tuyos, `/onboarding` ofrece un atajo
para sembrar un household de demostración (sin datos personales, ver
`src/lib/seed/demo-household.ts`).

## Preguntas frecuentes

**¿Necesito Docker para desarrollar?** No. Este repo se desarrolló sin Docker, contra un
proyecto de Supabase remoto. Docker solo entra en juego si elegís deployar la app en un
contenedor (Opción B arriba) o si vos mismo levantás el stack de self-host de Supabase.

**¿Puedo usar mi propia moneda/país?** Sí — `currencies`/`countries`/`institutions` son
catálogos globales sembrados por migración, pero cualquier household puede clonar y
personalizar una fila (ver el patrón "copy-on-write" en `docs/01-arquitectura-datos.md` § 3).

**¿Qué pasa con mis datos si dejo de pagar Supabase / apago el servidor?** Los datos viven
primero en tu dispositivo (IndexedDB, vía Dexie) y se sincronizan con tu proyecto de Supabase.
Podés exportar un backup completo en JSON en cualquier momento desde
**Más → Exportar y backup**.
