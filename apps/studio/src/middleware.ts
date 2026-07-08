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
     * Protect the entire Studio app except static assets and Next internals.
     * Login stays public via resolveAuthMiddleware / isLoginPath.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
