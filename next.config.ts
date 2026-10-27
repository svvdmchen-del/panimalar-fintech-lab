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
  },
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
