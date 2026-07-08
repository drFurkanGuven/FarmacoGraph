"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthApiError } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/context";

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const apiKeySchema = z.object({
  apiKey: z.string().min(8, "API key is required"),
});

type PasswordForm = z.infer<typeof passwordSchema>;
type ApiKeyForm = z.infer<typeof apiKeySchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const { loginWithPassword, loginWithApiKey, isLoading, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"password" | "apiKey">("apiKey");

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });

  const apiKeyForm = useForm<ApiKeyForm>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { apiKey: "" },
  });

  useEffect(() => {
    if (isAuthenticated) router.replace(returnTo);
  }, [isAuthenticated, returnTo, router]);

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    try {
      await loginWithPassword(values.email, values.password);
      toast.success("Signed in");
      router.replace(returnTo);
    } catch (error) {
      const message = error instanceof AuthApiError ? error.message : "Sign in failed";
      toast.error(message);
    }
  });

  const onApiKeySubmit = apiKeyForm.handleSubmit(async (values) => {
    try {
      await loginWithApiKey(values.apiKey);
      toast.success("API key saved");
      router.replace(returnTo);
    } catch (error) {
      const message = error instanceof AuthApiError ? error.message : "Sign in failed";
      toast.error(message);
    }
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Studio</CardTitle>
          <CardDescription>
            Use an API key or account credentials. JWT refresh is supported when the auth API is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "apiKey" ? "default" : "outline"}
              onClick={() => setMode("apiKey")}
            >
              API key
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "password" ? "default" : "outline"}
              onClick={() => setMode("password")}
            >
              Email & password
            </Button>
          </div>

          {mode === "apiKey" ? (
            <form className="space-y-4" onSubmit={onApiKeySubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="apiKey">
                  API key
                </label>
                <Input
                  id="apiKey"
                  type="password"
                  autoComplete="off"
                  placeholder="fg_xxxxxxxx_yyyyyyyy"
                  {...apiKeyForm.register("apiKey")}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Continue with API key
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onPasswordSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input id="email" type="email" autoComplete="email" {...passwordForm.register("email")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register("password")}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Sign in
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Or paste a JWT manually in{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading sign-in…</div>}>
      <LoginForm />
    </Suspense>
  );
}
