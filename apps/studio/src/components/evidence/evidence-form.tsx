"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ONTOLOGY_EVIDENCE_TYPES, createEvidence, updateEvidence } from "@/lib/api/evidence";
import { ApiError } from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { useEvidenceDetail } from "./hooks/use-evidence-browser";
import type { EvidenceFormMode } from "./types";
import { DEFAULT_EVIDENCE_FORM_VALUES } from "./types";
import { formatEvidenceTypeLabel, recordToFormValues } from "./utils";

const evidenceFormSchema = z.object({
  evidence_type: z.enum(ONTOLOGY_EVIDENCE_TYPES),
  title: z.string().min(1, "Title is required"),
  authors: z.string(),
  year: z.string(),
  quality_score: z
    .string()
    .refine((value) => value === "" || (Number(value) >= 0 && Number(value) <= 1), {
      message: "Quality score must be between 0 and 1",
    }),
  journal: z.string(),
  extract: z.string(),
  supports_claim: z.string(),
});

type EvidenceFormSchema = z.infer<typeof evidenceFormSchema>;

interface EvidenceFormDialogProps {
  open: boolean;
  mode: EvidenceFormMode;
  evidenceId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function EvidenceFormDialog({
  open,
  mode,
  evidenceId,
  onClose,
  onSaved,
}: EvidenceFormDialogProps) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const detailQuery = useEvidenceDetail(mode === "edit" && open ? (evidenceId ?? null) : null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<EvidenceFormSchema>({
    resolver: zodResolver(evidenceFormSchema),
    defaultValues: DEFAULT_EVIDENCE_FORM_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      form.reset(DEFAULT_EVIDENCE_FORM_VALUES);
      setStatusMessage(null);
      setStatusOk(null);
      return;
    }
    const record = detailQuery.data?.data;
    if (record) {
      form.reset(recordToFormValues(record));
    }
  }, [open, mode, detailQuery.data, form]);

  function formValuesToApiBody(values: EvidenceFormSchema) {
    const authors = values.authors
      .split(",")
      .map((author) => author.trim())
      .filter(Boolean);
    return {
      title: values.title.trim(),
      evidence_type: values.evidence_type,
      authors,
      year: values.year ? Number(values.year) : null,
      quality_score: values.quality_score ? Number(values.quality_score) : 0.5,
      journal: values.journal.trim() || null,
      extract: values.extract.trim() || null,
      supports_claim: values.supports_claim.trim() || null,
    };
  }

  async function saveEvidence(values: EvidenceFormSchema) {
    setIsSaving(true);
    setStatusMessage(null);
    setStatusOk(null);
    try {
      const body = formValuesToApiBody(values);
      if (mode === "create") {
        await createEvidence(client, body);
        setStatusOk(true);
        setStatusMessage("Evidence created successfully.");
      } else if (evidenceId) {
        await updateEvidence(client, evidenceId, body);
        setStatusOk(true);
        setStatusMessage("Evidence updated successfully.");
      }
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.evidenceSearch("", 100) });
      if (evidenceId) {
        await queryClient.invalidateQueries({ queryKey: apiQueryKeys.evidence(evidenceId) });
      }
      onSaved?.();
      onClose();
    } catch (error) {
      setStatusOk(false);
      if (error instanceof ApiError && error.status === 503) {
        setStatusMessage("Evidence writes require Neo4j (FG_NEO4J_ENABLED=true).");
      } else {
        setStatusMessage(error instanceof ApiError ? error.message : "Failed to save evidence.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create evidence" : "Edit evidence"}</DialogTitle>
          <DialogDescription>
            Create or update evidence records via POST/PATCH /evidence. Writes require Neo4j.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => void saveEvidence(values))}
          >
            <FormField
              control={form.control}
              name="evidence_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evidence type</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...field}
                    >
                      {ONTOLOGY_EVIDENCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {formatEvidenceTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Study or source title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="authors"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authors</FormLabel>
                    <FormControl>
                      <Input placeholder="Comma-separated" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="quality_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality score (0–1)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={1} step={0.05} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="journal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Journal / source</FormLabel>
                    <FormControl>
                      <Input placeholder="Journal or regulator" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="supports_claim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supports claim</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="What clinical assertion does this support?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extract"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extract</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Relevant quote or summary from the source" {...field} />
                  </FormControl>
                  <FormDescription>Only include text you can cite from a real source.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {statusMessage && (
              <div
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  statusOk ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {statusOk ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{statusMessage}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : mode === "create" ? (
                  "Create evidence"
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
