import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/storage";
import { isLoginLoopLocation } from "@/lib/auth/routes";
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

  it("excludes login from matcher so middleware never runs on /login/", () => {
    const patterns = config.matcher.join(" ");
    expect(patterns).toMatch(/\(\?!login/);
    expect(patterns).toContain("_next/static");
  });
});

describe("middleware auth redirect", () => {
  it("redirects anonymous `/` to login with returnTo=/", () => {
    const res = middleware(request("/"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/\/login\/?\?returnTo=%2F$/);
    expect(isLoginLoopLocation(location)).toBe(false);
  });

  it("if somehow invoked on /login/, must not redirect (safety net)", () => {
    // Matcher excludes login in production; this asserts resolve path is still safe.
    expect(middleware(request("/login")).status).toBe(200);
    expect(middleware(request("/login/")).headers.get("location")).toBeNull();
    const looped = middleware(request("/login/?returnTo=%2Flogin%2F"));
    expect(looped.headers.get("location")).toBeNull();
    expect(looped.status).toBe(200);
  });

  it("allows authenticated sessions through `/`", () => {
    const res = middleware(request("/", `${AUTH_COOKIE_NAME}=1`));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /dashboard/ with returnTo=/dashboard", () => {
    const res = middleware(request("/dashboard/"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/\/login\/?\?returnTo=%2Fdashboard/);
    expect(isLoginLoopLocation(location)).toBe(false);
  });

  it("redirects protected pages with returnTo set", () => {
    const res = middleware(request("/settings/"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/\/login\/?\?returnTo=%2Fsettings/);
    expect(isLoginLoopLocation(location)).toBe(false);
  });
});
