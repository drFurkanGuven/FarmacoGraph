"use client";

import { BookOpen, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui";
import type { DrugPublishPackage } from "./types";
import {
  type EducationKind,
  readEducationItem,
  updateEducationItem,
} from "./education";

export interface EducationSectionProps {
  pkg: DrugPublishPackage;
  drugId: string;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

function listValue(value: string[]): string {
  return value.join(", ");
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function EducationSection({
  pkg,
  drugId,
  disabled = false,
  onPackageChange,
}: EducationSectionProps) {
  const drugEntityId = String(pkg.entity_payload.id ?? drugId);
  const summary = readEducationItem(pkg, drugEntityId, "FiveSecondSummary");
  const pearl = readEducationItem(pkg, drugEntityId, "BoardExamPearl");

  function patch(kind: EducationKind, patchValue: Parameters<typeof updateEducationItem>[3]) {
    onPackageChange(updateEducationItem(pkg, drugEntityId, kind, patchValue));
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Education</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Student-facing explanations live in the education layer, separate from biomedical facts.
        </p>
      </div>

      <Card className="rounded-md">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4" />
            Five second summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <Textarea
            value={summary.text}
            disabled={disabled}
            maxLength={280}
            rows={3}
            placeholder="One rapid recall sentence for this drug."
            onChange={(event) => patch("FiveSecondSummary", { text: event.target.value })}
          />
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Stored as content_layer=education.</span>
            <span>{summary.text.length}/280</span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4" />
            Board exam pearl
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <Textarea
            value={pearl.text}
            disabled={disabled}
            rows={4}
            placeholder="High-yield exam insight, memory hook, or common trap."
            onChange={(event) => patch("BoardExamPearl", { text: event.target.value })}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Audience</span>
              <Input
                value={listValue(pearl.audience)}
                disabled={disabled}
                placeholder="medical_student"
                onChange={(event) =>
                  patch("BoardExamPearl", { audience: parseList(event.target.value) })
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Difficulty</span>
              <Input
                value={pearl.difficulty_level}
                disabled={disabled}
                placeholder="core"
                onChange={(event) =>
                  patch("BoardExamPearl", { difficulty_level: event.target.value })
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Exam tags</span>
              <Input
                value={listValue(pearl.exam_tags ?? [])}
                disabled={disabled}
                placeholder="TUS, USMLE Step1"
                onChange={(event) =>
                  patch("BoardExamPearl", { exam_tags: parseList(event.target.value) })
                }
              />
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
