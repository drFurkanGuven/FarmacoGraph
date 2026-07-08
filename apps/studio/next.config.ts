import type { NextConfig } from "next";
import path from "node:path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo: ensure Next traces from repo root so production builds
  // resolve correctly when built via docker-compose from /apps/studio.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Match nginx /studio/ — avoids redirect loop with Safari (trailing slash ping-pong)
  trailingSlash: Boolean(basePath),
};

export default nextConfig;
