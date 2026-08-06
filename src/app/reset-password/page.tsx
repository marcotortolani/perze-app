import { redirect } from "next/navigation";

/**
 * Stub de redirect de compatibilidad — ver `src/app/login/page.tsx`. El
 * link `type=recovery` (`src/emails/auth/recovery.tsx`) ya no apunta acá:
 * `auth/callback/route.ts` lo canjea y sigue directo a `/onboarding`.
 */
export default function ResetPasswordPage() {
  redirect("/onboarding");
}
