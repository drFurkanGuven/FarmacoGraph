import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import {
  isLoginLoopLocation,
  resolveAuthMiddleware,
  safeReturnTo,
} from "@/lib/auth/routes";

/**
 * Auth gate for Studio (runs with basePath stripped — pathnames are `/`, `/login/`, …).
 *
 * `/login` is excluded from `config.matcher` so middleware never runs on the login
 * page. That makes the production loop
 * `307 Location: /login/?returnTo=%2Flogin%2F` impossible at the matcher layer.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
  const decision = resolveAuthMiddleware(pathname, authenticated);

  if (decision.action === "next") {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = decision.loginPath;
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", safeReturnTo(decision.returnTo));

  const response = NextResponse.redirect(loginUrl);
  if (isLoginLoopLocation(response.headers.get("location"))) {
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
     * Explicit `/` — required under basePath `/studio` (Next otherwise skips root).
     *
     * Negative lookahead MUST include `login` so `/login` and `/login/` never enter
     * middleware. Without that, a stale isProtectedPath("/login/") → true caused:
     *   GET /studio/login/ → 307 → /studio/login/?returnTo=%2Flogin%2F
     *
     * Static assets stay unmatched (public).
     */
    "/",
    "/((?!login(?:/|$)|_next/static|_next/image|favicon\\.ico|robots\\.txt|manifest\\.webmanifest|build-id\\.txt|studio-build\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
