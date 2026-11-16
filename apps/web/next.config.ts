import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: "export",
        assetPrefix: "./",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
