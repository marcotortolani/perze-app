import { redirect } from "next/navigation";

/**
 * Stub de redirect de compatibilidad. La solución de transición de
 * contraseñas se revirtió (`docs/mejora-auth-oauth-y-email.md` § 0.1):
 * `CLAUDE.md` es categórico — sin contraseñas, ni acá ni nunca. Esta ruta
 * no se borra (`CLAUDE.md` § convención de rutas, punto 5): hay una PWA
 * instalada con historial largo y un 404 acá sería una regresión real.
 * Sin sesión, `proxy.ts` ya manda cualquier visita a `/onboarding` antes
 * de que esto llegue a renderizar — este `redirect` solo cubre a quien
 * llega con una sesión viva (bookmark, historial).
 */
export default function LoginPage() {
  redirect("/onboarding");
}
