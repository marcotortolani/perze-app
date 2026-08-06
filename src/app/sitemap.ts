import type { MetadataRoute } from "next";
import { env } from "@/env";

/** Dos URLs públicas hoy — `/start` (la landing) y `/about`. El resto del sitio exige sesión, no tiene sentido listarlo. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://perze.tortolani.cc";
  return [
    { url: `${siteUrl}/start`, changeFrequency: "monthly" },
    { url: `${siteUrl}/about`, changeFrequency: "monthly" },
  ];
}
