import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import { config, middleware } from "@/middleware";

function request(path: string, cookie?: string) {
  const url = new URL(path, "https://farmacograph.furkanguven.space");
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(url, { headers });
}

describe("middleware matcher", () => {
  it("explicitly includes app root so basePath /studio/ is guarded", () => {
    expect(config.matcher).toContain("/");
  });
});

describe("middleware auth redirect", () => {
  it("redirects anonymous `/` to login with returnTo=/", () => {
    const res = middleware(request("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://farmacograph.furkanguven.space/login?returnTo=%2F",
    );
  });

  it("does not redirect /login or /login/ (Task C loop signature)", () => {
    expect(middleware(request("/login")).status).toBe(200);
    expect(middleware(request("/login/")).headers.get("location")).toBeNull();
    const looped = middleware(request("/login/?returnTo=%2Flogin%2F"));
    expect(looped.headers.get("location")).toBeNull();
  });

  it("allows authenticated sessions through `/`", () => {
    const res = middleware(request("/", `${AUTH_COOKIE_NAME}=1`));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects protected pages with returnTo set", () => {
    const res = middleware(request("/settings/"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    // trailingSlash may yield /login/ vs /login — either is fine if returnTo is present
    expect(location).toMatch(/\/login\/?\?returnTo=%2Fsettings/);
  });
});
