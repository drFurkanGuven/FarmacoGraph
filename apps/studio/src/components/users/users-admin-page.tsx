"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, RefreshCw, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ApiError } from "@/lib/api";
import type { AdminApiKey, AdminUser } from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiQuery } from "@/lib/api/react-query/optimistic";
import { useApiClient } from "@/lib/hooks/use-api-client";

const ROLE_OPTIONS = [
  { value: "curator", label: "Curator" },
  { value: "reviewer", label: "Reviewer" },
  { value: "administrator", label: "Administrator" },
] as const;

function CreateUserDialog({ onCreated }: { onCreated: (user: AdminUser) => void }) {
  const client = useApiClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("curator");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setFullName("");
    setPassword("");
    setRole("curator");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await client.createUser({
        email,
        password,
        full_name: fullName.trim() || undefined,
        role,
      });
      toast.success(`Created ${result.data.email}`);
      onCreated(result.data);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Create a Studio account with role-based scopes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input id="user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Password (min 12)</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailPanel({
  user,
  onUpdated,
}: {
  user: AdminUser;
  onUpdated: (user: AdminUser) => void;
}) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState(user.role ?? "curator");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.full_name ?? "");
    setRole(user.role ?? "curator");
    setActive(user.is_active);
    setPassword("");
    setRevealedKey(null);
  }, [user]);

  const keysQuery = useApiQuery(apiQueryKeys.userApiKeys(user.id), () =>
    client.listUserApiKeys(user.id),
  );

  async function handleSave() {
    setSaving(true);
    try {
      const result = await client.updateUser(user.id, {
        full_name: fullName,
        role,
        is_active: active,
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      onUpdated(result.data);
      toast.success("User updated");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: [...apiQueryKeys.all, "users"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateKey() {
    if (!keyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await client.createUserApiKey(user.id, { name: keyName.trim() });
      setRevealedKey(result.data.api_key ?? null);
      setKeyName("");
      await keysQuery.refetch();
      toast.success("API key created — copy it now");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create API key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevoke(key: AdminApiKey) {
    if (!window.confirm(`Revoke key “${key.name}” (${key.key_prefix}…)?`)) return;
    try {
      await client.revokeUserApiKey(user.id, key.id);
      await keysQuery.refetch();
      toast.success("API key revoked");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Revoke failed");
    }
  }

  const keys = keysQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{user.email}</CardTitle>
          <CardDescription className="font-mono text-xs">{user.id}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-role">Role</Label>
            <select
              id="edit-role"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-password">New password (optional)</Label>
            <Input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              placeholder="Leave blank to keep current"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          <div className="flex flex-wrap gap-1">
            {user.scopes.map((scope) => (
              <Badge key={scope} variant="muted" className="font-mono text-[10px]">
                {scope}
              </Badge>
            ))}
          </div>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save user"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            API keys
          </CardTitle>
          <CardDescription>
            Keys inherit the user’s scopes. The full secret is shown only once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Key name (e.g. CI pipeline)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <Button
              size="sm"
              disabled={creatingKey || !keyName.trim()}
              onClick={() => void handleCreateKey()}
            >
              <Plus className="h-4 w-4" />
              Create key
            </Button>
          </div>
          {revealedKey ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="mb-1 font-medium">Copy this key now — it will not be shown again.</p>
              <code className="block break-all font-mono text-xs">{revealedKey}</code>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedKey);
                  toast.success("Copied");
                }}
              >
                Copy
              </Button>
            </div>
          ) : null}
          {keysQuery.isLoading ? (
            <TableSkeleton rows={2} />
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {key.key_prefix}… · {key.is_active ? "active" : "revoked"}
                      {key.last_used_at ? ` · last used ${key.last_used_at.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  {key.is_active ? (
                    <Button size="sm" variant="outline" onClick={() => void handleRevoke(key)}>
                      Revoke
                    </Button>
                  ) : (
                    <Badge variant="muted">revoked</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function UsersAdminPage() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const usersQuery = useApiQuery(apiQueryKeys.users({ search }), () =>
    client.listUsers({ search: search || undefined, limit: 100 }),
  );

  const users = usersQuery.data?.data ?? [];
  const selected = useMemo(
    () => users.find((row) => row.id === selectedId) ?? users[0] ?? null,
    [users, selectedId],
  );

  useEffect(() => {
    if (!selectedId && users[0]) setSelectedId(users[0].id);
  }, [users, selectedId]);

  const errorMessage =
    usersQuery.error instanceof ApiError ? usersQuery.error.message : "Failed to load users.";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage Studio accounts and issue API tokens (administrator only).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateUserDialog
            onCreated={(user) => {
              void queryClient.invalidateQueries({ queryKey: [...apiQueryKeys.all, "users"] });
              setSelectedId(user.id);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void usersQuery.refetch()}
            disabled={usersQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>Search by email or name.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {usersQuery.isLoading ? (
        <TableSkeleton rows={5} />
      ) : usersQuery.error ? (
        <ErrorState
          title="Unable to load users"
          message={errorMessage}
          onRetry={() => void usersQuery.refetch()}
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-6 w-6" />}
          title="No users found"
          description="Create an account to grant Studio access."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {users.map((user) => {
                  const active = selected?.id === user.id;
                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                          active ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setSelectedId(user.id)}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{user.email}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {user.full_name || "—"} · {user.role ?? "no role"}
                          </p>
                        </div>
                        <Badge variant={user.is_active ? "success" : "muted"}>
                          {user.is_active ? "active" : "inactive"}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
          {selected ? (
            <UserDetailPanel
              user={selected}
              onUpdated={(user) => {
                setSelectedId(user.id);
                void queryClient.invalidateQueries({ queryKey: [...apiQueryKeys.all, "users"] });
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
