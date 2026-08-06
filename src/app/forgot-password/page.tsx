import { redirect } from "next/navigation";

/**
 * Stub de redirect de compatibilidad — ver `src/app/login/page.tsx`. Sin
 * contraseñas no hay nada que recuperar; el acceso de emergencia real (si
 * el OTP falla) lo dispara el operador a mano desde el Dashboard de
 * Supabase con la plantilla `recovery` (`src/emails/auth/recovery.tsx`).
 */
export default function ForgotPasswordPage() {
  redirect("/onboarding");
}
