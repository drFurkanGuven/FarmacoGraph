import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import { resolveAuthMiddleware } from "@/lib/auth/routes";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
  const decision = resolveAuthMiddleware(pathname, authenticated);

  if (decision.action === "next") {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = decision.loginPath;
  if (decision.returnTo) {
    loginUrl.searchParams.set("returnTo", decision.returnTo);
  } else {
    loginUrl.searchParams.delete("returnTo");
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * With basePath `/studio`, the common negative-lookahead matcher alone does
     * NOT run on the app root (`/studio/` → pathname `/`). That skips the auth
     * redirect and can surface as an empty 200 document at the edge.
     * Explicit `/` is required — see next.js#62078 / #73786.
     *
     * Login stays public via resolveAuthMiddleware / isLoginPath (never
     * Location: /login/?returnTo=/login/).
     */
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
