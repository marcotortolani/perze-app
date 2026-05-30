import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Empty turbopack config tells Next.js to use Turbopack in dev (Serwist is disabled in dev anyway)
  turbopack: {},
};

export default withSerwist(nextConfig);
