import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";

/**
 * 404 raíz — para cualquier ruta rota fuera de `(app)/` (link externo
 * roto, URL tipeada a mano, un deep link viejo). `(app)/not-found.tsx` es
 * el que atiende una navegación de cliente ya adentro del shell; este es
 * el que ve un visitante nuevo o una carga dura, así que trae su propio
 * wordmark en vez de asumir que hay sidebar/tab bar montados.
 */
export default async function NotFound() {
  const t = await getTranslations();

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Logo size={20} />
      <ZMark size={16} gap={5} />
      <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "28ch" }}>
        {t("notFoundPage.message")}
      </p>
      <Link
        href="/"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 280,
          textAlign: "center",
          height: "var(--primary-button-height)",
          lineHeight: "var(--primary-button-height)",
          borderRadius: "var(--radius-button)",
          background: "var(--primary-fill)",
          color: "var(--primary-on-fill)",
          fontWeight: 600,
          fontSize: 16,
          textDecoration: "none",
          marginTop: 8,
        }}
      >
        {t("notFoundPage.action")}
      </Link>
    </ScreenShell>
  );
}
