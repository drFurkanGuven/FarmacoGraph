"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/context";

const authSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  accessToken: z.string().optional(),
  apiKey: z.string().optional(),
});

type AuthForm = z.infer<typeof authSchema>;

export default function SettingsPage() {
  const { session, signIn, signOut, isAuthenticated } = useAuth();
  const form = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      displayName: session.displayName,
      email: session.email ?? "",
      accessToken: session.accessToken ?? "",
      apiKey: session.apiKey ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    signIn({
      displayName: values.displayName,
      email: values.email || null,
      accessToken: values.accessToken || null,
      refreshToken: null,
      apiKey: values.apiKey || null,
    });
    toast.success("Session updated");
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Authentication hooks for JWT and API keys (SSO-ready).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Placeholder profile — full user management ships later.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="displayName">
                Display name
              </label>
              <Input id="displayName" {...form.register("displayName")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="accessToken">
                JWT access token
              </label>
              <Input id="accessToken" type="password" autoComplete="off" {...form.register("accessToken")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="apiKey">
                API key
              </label>
              <Input id="apiKey" type="password" autoComplete="off" {...form.register("apiKey")} />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save session</Button>
              {isAuthenticated && (
                <Button type="button" variant="outline" onClick={signOut}>
                  Sign out
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API connection</CardTitle>
        </CardHeader>
        <CardContent className="font-mono text-xs text-muted-foreground">
          {process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001/api/v1"}
        </CardContent>
      </Card>
    </div>
  );
}
