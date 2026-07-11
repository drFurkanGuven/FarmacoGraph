"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiClient } from "@/lib/hooks/use-api-client";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateDrugDialog() {
  const client = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [drugClassSlug, setDrugClassSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const classesQuery = useQuery({
    queryKey: [...apiQueryKeys.all, "curator-drug-classes"],
    queryFn: () => client.curatorDrugClasses(),
    enabled: open,
  });
  const classes = classesQuery.data?.data ?? [];

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(label));
  }, [label, slugTouched]);

  useEffect(() => {
    if (!drugClassSlug && classes.length > 0) {
      setDrugClassSlug(classes[0].slug);
    }
  }, [classes, drugClassSlug]);

  function resetForm() {
    setLabel("");
    setSlug("");
    setSlugTouched(false);
    setDrugClassSlug(classes[0]?.slug ?? "");
    setDescription("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await client.createDrug({
        slug,
        label,
        drug_class_slug: drugClassSlug,
        description: description.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: [...apiQueryKeys.all, "curator-drugs"] });
      setOpen(false);
      resetForm();
      router.push(`/knowledge/drugs/${result.data.entity.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create drug.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add drug
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add drug</DialogTitle>
            <DialogDescription>
              Choose a drug class, then register a draft drug and open the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="drug-class">Drug class</Label>
            <select
              id="drug-class"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={drugClassSlug}
              onChange={(event) => setDrugClassSlug(event.target.value)}
              required
              disabled={classesQuery.isLoading || classes.length === 0}
            >
              {classes.map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drug-label">Label</Label>
            <Input
              id="drug-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ramipril"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drug-slug">Slug</Label>
            <Input
              id="drug-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              placeholder="ramipril"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drug-description">Description</Label>
            <Textarea
              id="drug-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional curator note"
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !label.trim() || !slug.trim() || !drugClassSlug}
            >
              {submitting ? "Creating…" : "Create & open"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
