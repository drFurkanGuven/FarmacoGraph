import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import { isLoginPath, isProtectedPath, LOGIN_PATH } from "@/lib/auth/routes";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never bounce /login or /login/ — trailingSlash + auth redirect used to loop
  // (/login/ → requireAuth → redirect /login/?returnTo=/login/) and blank the page.
  if (isLoginPath(pathname) || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authenticated = request.cookies.get(AUTH_COOKIE_NAME)?.value === "1";
  if (authenticated) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  const returnTo = pathname === "/" ? "/" : pathname;
  if (!isLoginPath(returnTo)) {
    loginUrl.searchParams.set("returnTo", returnTo);
  } else {
    loginUrl.searchParams.delete("returnTo");
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Protect the entire Studio app except static assets and Next internals.
     * Login stays public via isLoginPath / isProtectedPath.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
