const LOCAL_DEFAULT = "http://127.0.0.1:8001/api/v1";

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "host.docker.internal"
  );
}

function isUnsafeBrowserApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return isPrivateOrLoopbackHost(parsed.hostname);
  } catch {
    return true;
  }
}

/**
 * Resolve the Studio → API base URL.
 *
 * Production Studio is served from the same host as nginx (`/studio` + `/api/v1`).
 * If a build accidentally baked `127.0.0.1` / `localhost` / `host.docker.internal`
 * into `NEXT_PUBLIC_API_URL`, the browser on a curator PC cannot reach it —
 * fall back to same-origin `/api/v1`.
 */
export function resolveStudioApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured && !isUnsafeBrowserApiUrl(configured)) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (!isPrivateOrLoopbackHost(hostname)) {
      return `${origin}/api/v1`;
    }
  }

  return (configured || LOCAL_DEFAULT).replace(/\/$/, "");
}
