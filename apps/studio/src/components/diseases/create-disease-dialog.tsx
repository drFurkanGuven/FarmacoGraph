"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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

export function CreateDiseaseDialog() {
  const client = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [icd10, setIcd10] = useState("");
  const [mesh, setMesh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(label));
    }
  }, [label, slugTouched]);

  function resetForm() {
    setLabel("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setIcd10("");
    setMesh("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await client.createDisease({
        slug,
        label,
        description: description.trim() || undefined,
        icd10: icd10.trim() || undefined,
        mesh: mesh.trim() || undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: [...apiQueryKeys.all, "curator-diseases"],
      });
      setOpen(false);
      resetForm();
      router.push(`/knowledge/diseases/${result.data.entity.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create disease.");
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
          Add disease
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Add disease</DialogTitle>
            <DialogDescription>
              Register a disease in the curator catalog and open a draft workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="disease-label">Label</Label>
              <Input
                id="disease-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Heart failure"
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="disease-slug">Slug</Label>
              <Input
                id="disease-slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="heart-failure"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="Lowercase kebab-case"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="disease-description">Description</Label>
              <Textarea
                id="disease-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional clinical summary"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="disease-icd10">ICD-10</Label>
                <Input
                  id="disease-icd10"
                  value={icd10}
                  onChange={(event) => setIcd10(event.target.value)}
                  placeholder="I50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="disease-mesh">MeSH</Label>
                <Input
                  id="disease-mesh"
                  value={mesh}
                  onChange={(event) => setMesh(event.target.value)}
                  placeholder="D006333"
                />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !label.trim() || !slug.trim()}>
              {submitting ? "Creating…" : "Create & open"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
