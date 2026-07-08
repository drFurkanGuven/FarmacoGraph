import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import {
  isLoginLoopLocation,
  isLoginPath,
  resolveAuthMiddleware,
  safeReturnTo,
} from "@/lib/auth/routes";

/**
 * Auth gate for Studio. Pathnames are normally basePath-stripped (`/login/`, `/`, …).
 * Login is public even if matcher or NEXT_PUBLIC_BASE_PATH at runtime is wrong.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hard stop — must run before any auth logic (fixes returnTo=%2Flogin%2F loop).
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
    "/",
    "/((?!login(?:/|$)|studio/login(?:/|$)|_next/static|_next/image|favicon\\.ico|robots\\.txt|manifest\\.webmanifest|build-id\\.txt|studio-build\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|json|webmanifest)$).*)",
  ],
};
