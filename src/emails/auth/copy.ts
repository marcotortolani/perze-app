/**
 * Copy de los emails de Auth — **español fijo**, a propósito.
 *
 * El Dashboard de Supabase tiene una sola plantilla por tipo (`magic_link`,
 * `recovery`, …) y GoTrue no expone el locale del usuario como variable de
 * plantilla: no hay forma de mandar el mail en el idioma que el usuario
 * eligió en Ajustes sin sacar el envío de Auth de Supabase por completo
 * (lo que exigiría `service_role` fuera de una Edge Function, prohibido
 * por `CLAUDE.md`). Dos caminos evaluados y descartados:
 *
 * - Condicionales Go sobre una variable de locale en `user_metadata`:
 *   técnicamente posible, pero triplica el cuerpo de cada plantilla y
 *   vuelve el diff del export (`scripts/export-email-templates.mjs`)
 *   inauditable.
 * - Mandar el OTP desde la app en vez de GoTrue: exige `auth.admin`, que
 *   es `service_role` puertas afuera de una Edge Function.
 *
 * La i18n real (ES/EN/PT) vive solo en los emails que manda la propia app
 * — hoy, la invitación al household (`src/emails/invite.tsx`), que sí
 * pasa por next-intl.
 */
export const authEmailCopy = {
  magicLink: {
    preview: "Tu código de acceso a PERZE",
    title: "Tu código de PERZE",
    body: "Ingresá este código en la app para continuar. Vence en 10 minutos.",
    buttonLabel: "O continuá con un click",
    footerSecurity: "Si no pediste este código, podés ignorar este correo — nadie puede entrar a tu cuenta sin él.",
    footerPrivacy:
      "Quien administra esta instalación de PERZE aprueba manualmente cada acceso nuevo y puede ver tu email, tu país y cuándo usaste la app por última vez — nunca tus movimientos, saldos, cuentas ni presupuestos. No hay analytics de terceros.",
  },
  recovery: {
    preview: "Acceso de emergencia a PERZE",
    title: "Tu acceso de emergencia",
    body: "Alguien con acceso al panel de administración de esta instalación de PERZE pidió este link para vos. Si no lo esperabas, ignorá este correo.",
    buttonLabel: "Entrar a PERZE",
    footerSecurity: "Este link vence en 10 minutos y solo funciona una vez.",
    footerPrivacy:
      "Quien administra esta instalación de PERZE aprueba manualmente cada acceso nuevo y puede ver tu email, tu país y cuándo usaste la app por última vez — nunca tus movimientos, saldos, cuentas ni presupuestos. No hay analytics de terceros.",
  },
} as const;
