"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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
import { ONTOLOGY_EVIDENCE_TYPES } from "@/lib/api/evidence";
import { ApiError } from "@/lib/api";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { useEvidenceDetail } from "./hooks/use-evidence-browser";
import type { EvidenceFormMode } from "./types";
import { DEFAULT_EVIDENCE_FORM_VALUES } from "./types";
import { evidenceFormToPayload, formatEvidenceTypeLabel, recordToFormValues } from "./utils";

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
}

export function EvidenceFormDialog({ open, mode, evidenceId, onClose }: EvidenceFormDialogProps) {
  const client = useApiClient();
  const detailQuery = useEvidenceDetail(mode === "edit" && open ? (evidenceId ?? null) : null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validationOk, setValidationOk] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const form = useForm<EvidenceFormSchema>({
    resolver: zodResolver(evidenceFormSchema),
    defaultValues: DEFAULT_EVIDENCE_FORM_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      form.reset(DEFAULT_EVIDENCE_FORM_VALUES);
      setValidationMessage(null);
      setValidationOk(null);
      return;
    }
    const record = detailQuery.data?.data;
    if (record) {
      form.reset(recordToFormValues(record));
    }
  }, [open, mode, detailQuery.data, form]);

  async function validateDraft(values: EvidenceFormSchema) {
    setIsValidating(true);
    setValidationMessage(null);
    setValidationOk(null);
    try {
      const payload = evidenceFormToPayload(values);
      const result = await client.validatePackage({
        entity_payload: {
          id: "validation-stub-drug",
          entity_type: "Drug",
          slug: "validation-stub",
          generic_name: "Validation Stub",
        },
        related_entities: [payload],
        relationships: [],
      });
      const valid = result.data.valid;
      setValidationOk(valid);
      setValidationMessage(
        valid
          ? "Package validation passed for the evidence payload shape."
          : `Validation reported ${result.data.issues.length} issue(s).`,
      );
    } catch (error) {
      setValidationOk(false);
      setValidationMessage(error instanceof ApiError ? error.message : "Validation request failed.");
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create evidence" : "Edit evidence"}</DialogTitle>
          <DialogDescription>
            Evidence write endpoints are not yet available on the public API. Use validate to dry-run
            the payload via POST /curator/validate.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => void validateDraft(values))}
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

            {validationMessage && (
              <div
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  validationOk ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {validationOk ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{validationMessage}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Save/publish requires evidence write API (Task A).
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isValidating}>
                  {isValidating ? "Validating…" : "Validate payload"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
