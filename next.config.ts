import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/export/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

export default nextConfig;
