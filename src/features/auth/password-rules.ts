/**
 * Mismo criterio que `password_requirements = lower_upper_letters_digits`
 * en `supabase/config.toml` (E15/E16) — validar en el cliente evita el
 * viaje de red solo para enterarse de que falta un dígito. Compartido
 * entre `/onboarding/register`, `/reset-password` y `more/security` para
 * no tener el mismo regex escrito tres veces.
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
