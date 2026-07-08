const LOCAL_DEFAULT = "http://127.0.0.1:8001/api/v1";

function isLoopbackUrl(url: string): boolean {
  return /:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url);
}

/**
 * Resolve the Studio → API base URL.
 *
 * Production Studio is served from the same host as nginx (`/studio` + `/api/v1`).
 * If a build accidentally baked `127.0.0.1` into `NEXT_PUBLIC_API_URL`, the browser
 * on a curator PC cannot reach it — fall back to same-origin `/api/v1`.
 */
export function resolveStudioApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured && !isLoopbackUrl(configured)) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${origin}/api/v1`;
    }
  }

  return (configured || LOCAL_DEFAULT).replace(/\/$/, "");
}
