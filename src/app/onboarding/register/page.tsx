import { redirect } from "next/navigation";

/**
 * Stub de redirect de compatibilidad — ver `src/app/login/page.tsx`. Era
 * el paso "nombre + contraseña" de la transición (A2b); el nombre ahora
 * llega poblado desde el signup (`handle_new_user()`,
 * `20260801030000_auth_new_user_trigger.sql`) y se corrige después desde
 * `/more/profile` si hace falta.
 */
export default function OnboardingRegisterPage() {
  redirect("/onboarding");
}
