import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/india-stock-mcp/**/*",
      "./node_modules/@modelcontextprotocol/**/*",
      "./node_modules/nse-bse-api/**/*",
      "./node_modules/zod/**/*",
      "./node_modules/yahoo-finance2/**/*",
    ],
    // The PDF route inlines the college crest at render time and needs the
    // Chromium driver's assets (browsers.json, protocol json) at runtime.
    "/api/report/pdf": ["./public/panimalar-crest.png", "./node_modules/playwright-core/**/*"],
  },
  // Chromium driver must stay a real node_modules require, never bundled.
  serverExternalPackages: ["playwright-core"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
