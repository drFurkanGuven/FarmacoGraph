import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import {
  isLoginLoopLocation,
  isLoginPath,
  resolveAuthMiddleware,
  safeReturnTo,
} from "@/lib/auth/routes";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hard stop: login is always public. Never set returnTo from this path.
  // (Historical bug: PUBLIC_ROUTES.has("/login/") was false → 307 → returnTo=/login/)
  if (isLoginPath(pathname)) {
    return NextResponse.next();
  }

  const authenticated = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
  const decision = resolveAuthMiddleware(pathname, authenticated);

  if (decision.action === "next") {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = decision.loginPath;
  // Keep query clean — only a sanitized returnTo.
  loginUrl.search = "";
  const returnTo = safeReturnTo(decision.returnTo);
  loginUrl.searchParams.set("returnTo", returnTo);

  const response = NextResponse.redirect(loginUrl);
  const location = response.headers.get("location");
  if (isLoginLoopLocation(location)) {
    // Last-resort guard: never ship the loop Location header.
    const fallback = request.nextUrl.clone();
    fallback.pathname = decision.loginPath;
    fallback.search = "";
    fallback.searchParams.set("returnTo", "/");
    return NextResponse.redirect(fallback);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * With basePath `/studio`, the common negative-lookahead matcher alone does
     * NOT run on the app root (`/studio/` → pathname `/`). Explicit `/` required.
     * Static assets under `/_next/static` stay unmatched (public).
     * Login stays public via isLoginPath (never Location: /login/?returnTo=/login/).
     */
    "/",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
