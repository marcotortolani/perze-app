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
   cualquier generador de claves EC P-256) — no reutilices las de otro deploy. La función
   queda desplegada pero **sin disparador automático**: alguien tiene que invocarla (un cron,
   un webhook, o a mano) cuando corresponda mandar cada tipo de notificación. Encender un
   envío recurrente es una decisión de producto (qué evento dispara cada aviso, con qué
   frecuencia) que este repo no toma por vos.

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
