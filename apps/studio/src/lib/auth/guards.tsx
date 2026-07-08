"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "./context";
import { matchRouteGuard, LOGIN_PATH, isLoginPath, loginRedirectUrl } from "./routes";
import type { RouteGuardConfig } from "./routes";

interface ProtectedRouteProps {
  config: RouteGuardConfig;
  children: React.ReactNode;
}

function UnauthorizedCard({
  title,
  description,
  returnTo,
}: {
  title: string;
  description: string;
  returnTo: string;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild>
            <Link href={loginRedirectUrl(returnTo)}>Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Configure credentials</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProtectedRoute({ config, children }: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? pathname;

  useEffect(() => {
    if (config.requireAuth && !isAuthenticated && !isLoginPath(pathname)) {
      router.replace(loginRedirectUrl(pathname));
    }
  }, [config.requireAuth, isAuthenticated, pathname, router]);

  if (config.requireAuth && !isAuthenticated) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (config.roles?.length && !hasRole(config.roles)) {
    return (
      <UnauthorizedCard
        title="Insufficient role"
        description="Your account does not have the role required for this page."
        returnTo={returnTo}
      />
    );
  }

  if (config.scopes?.length && !hasPermission(config.scopes)) {
    return (
      <UnauthorizedCard
        title="Missing permission"
        description="Your credentials lack the scopes required for this page."
        returnTo={returnTo}
      />
    );
  }

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const guard = matchRouteGuard(pathname);

  if (!guard) return <>{children}</>;

  return <ProtectedRoute config={guard}>{children}</ProtectedRoute>;
}
