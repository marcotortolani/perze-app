"use client";

/**
 * Biometría local (§2 del plan de acceso controlado) — WebAuthn puramente
 * LOCAL, no un passkey de Supabase. Es re-entrada al mismo dispositivo ya
 * logueado, exactamente el modelo de confianza del PIN (`pin-hash.ts`):
 * no hay servidor que verificar, el desafío es un random del navegador y
 * nunca sale del dispositivo. Por eso NO hay verificación de firma del
 * lado del cliente contra la clave pública — sería criptografía de
 * utilería sin nada real que defender (un contexto de página ya
 * comprometido puede saltarse el PIN con la misma facilidad). El único
 * hecho que importa es que el sensor del sistema operativo resolvió la
 * promesa para ESTE credential.
 */

const RP_NAME = "PERZE";

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

export function isBiometricSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

/** El dispositivo tiene un sensor utilizable (Face ID, Touch ID, huella de Android/Windows Hello). */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Enrola un credential de plataforma y devuelve su id (base64url) para guardar en `pin-store`. */
export async function registerBiometric(userLabel: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME },
      user: { id: userId, name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256, fallback en autenticadores viejos
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "required" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("No se pudo crear la credencial biométrica");
  return bufferToBase64Url(credential.rawId);
}

/** `true` si el sensor confirmó la presencia del usuario para este credential exacto. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64UrlToBuffer(credentialId), type: "public-key" }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!assertion;
  } catch {
    // Cancelado por el usuario, sin credential, timeout — todos caen acá y
    // se resuelven igual: `false`, nunca lanzan hacia el llamador. El
    // llamador cae al PIN.
    return false;
  }
}
