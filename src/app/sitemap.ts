import type { MetadataRoute } from "next";
import { env } from "@/env";

/** Un solo URL público hoy — `/about`. El resto del sitio exige sesión, no tiene sentido listarlo. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://perze.tortolani.cc";
  return [{ url: `${siteUrl}/about`, changeFrequency: "monthly" }];
}
