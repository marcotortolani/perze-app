import { Img } from "@react-email/components";

/**
 * `docs/marca/assets/README.md`: "El logotipo no aparece dentro de la
 * app… vive en el splash, el README, 'acerca de' y la preview al
 * compartir el link" — un email es exactamente uno de esos contextos
 * externos donde el wordmark sí corresponde.
 *
 * SVG no se renderiza de forma confiable en Gmail ni en Outlook: va como
 * PNG absoluto (generado por `scripts/generate-email-assets.mjs` desde
 * `perze-design/perze-brand/assets/wordmark-light.svg`), con `alt` para
 * cuando el cliente bloquea imágenes. Piso de marca: 14px de altura de
 * mayúscula (viewBox 144.34×42 → ratio ~3.44).
 *
 * Nunca el símbolo Z al lado del nombre — ese lockup está prohibido
 * (README de marca: "decía la Z dos veces, tartamudeo").
 */
export function Wordmark({ siteUrl, height = 24 }: { siteUrl: string; height?: number }) {
  const width = Math.round(height * (144.34 / 42));
  return <Img src={`${siteUrl}/email/wordmark-light.png`} width={width} height={height} alt="PERZE" style={{ display: "block" }} />;
}
