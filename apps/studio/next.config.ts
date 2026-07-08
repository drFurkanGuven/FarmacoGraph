import type { NextConfig } from "next";
import path from "node:path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Match nginx /studio/ — avoids redirect loop with Safari (trailing slash ping-pong)
  trailingSlash: Boolean(basePath),
};

export default nextConfig;
