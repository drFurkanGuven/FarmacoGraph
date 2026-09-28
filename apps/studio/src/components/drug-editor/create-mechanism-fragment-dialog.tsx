"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { useLanguage } from "@/lib/i18n/context";
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

export const MECHANISM_FRAGMENT_TYPES = [
  "molecular",
  "cellular",
  "tissue",
  "organ",
  "clinical",
] as const;

export const MECHANISM_FRAGMENT_DIRECTIONS = [
  "increase",
  "decrease",
  "inhibit",
  "activate",
  "unknown",
] as const;

export interface CreateMechanismFragmentDialogProps {
  onCreated?: (entity: {
    id: string;
    slug: string;
    label: string;
    description?: string | null;
    fragment_type?: string | null;
    direction?: string | null;
  }) => void;
  triggerLabel?: string;
}

export function CreateMechanismFragmentDialog({
  onCreated,
  triggerLabel = "New fragment",
}: CreateMechanismFragmentDialogProps) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [fragmentType, setFragmentType] = useState<string>("cellular");
  const [direction, setDirection] = useState<string>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(label));
  }, [label, slugTouched]);

  function resetForm() {
    setLabel("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setFragmentType("cellular");
    setDirection("unknown");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await client.createMechanismFragment({
        slug,
        label,
        description: description.trim() || undefined,
        fragment_type: fragmentType || undefined,
        direction: direction || undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: [...apiQueryKeys.all, "curator-mechanism-fragments"],
      });
      onCreated?.(result.data.entity);
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create mechanism fragment.");
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
        <Button type="button" size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("mechanism.newFragment", "New mechanism fragment")}</DialogTitle>
            <DialogDescription>
              {t(
                "mechanism.newFragmentHint",
                "Registers a MechanismFragment in the curator catalog for pathway authoring."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mechanism-fragment-label">{t("mechanism.label", "Label")}</Label>
            <Input
              id="mechanism-fragment-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Bradykinin accumulation"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mechanism-fragment-slug">{t("mechanism.slug", "Slug")}</Label>
            <Input
              id="mechanism-fragment-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              placeholder="bradykinin-accumulation"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mechanism-fragment-type">
                {t("mechanism.fragmentType", "Fragment level")}
              </Label>
              <select
                id="mechanism-fragment-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={fragmentType}
                onChange={(event) => setFragmentType(event.target.value)}
                required
              >
                {MECHANISM_FRAGMENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mechanism-fragment-direction">
                {t("mechanism.direction", "Direction")}
              </Label>
              <select
                id="mechanism-fragment-direction"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
              >
                {MECHANISM_FRAGMENT_DIRECTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              {t("mechanism.levelGuideTitle", "Which level?")}
            </p>
            {MECHANISM_FRAGMENT_TYPES.map((option) => (
              <p key={option}>{t(`mechanism.level.${option}`, option)}</p>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mechanism-fragment-description">
              {t("mechanism.description", "Description")}
            </Label>
            <Textarea
              id="mechanism-fragment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("mechanism.descriptionPlaceholder", "Optional curator note")}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("evidence.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !label.trim() || !slug.trim()}>
              {submitting
                ? t("mechanism.creating", "Creating…")
                : t("mechanism.create", "Create fragment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
