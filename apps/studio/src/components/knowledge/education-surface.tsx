"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, GraduationCap, Layers3, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDrugEducation, useDrugFlashcards } from "@/lib/api/react-query/hooks";
import type { EducationResource } from "@/lib/api";
import { KnowledgeSurface, commonKnowledgeLinks } from "./knowledge-surface";

function contentPreview(item: EducationResource): string {
  return (
    item.text ||
    item.mnemonic ||
    item.mistake ||
    item.front ||
    item.label ||
    "Education content"
  );
}

function detailPreview(item: EducationResource): string | null {
  return item.expansion || item.correction || item.back || item.why_wrong || item.hint || null;
}

function EducationItemCard({ item }: { item: EducationResource }) {
  const detail = detailPreview(item);
  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{item.kind ?? "Education"}</CardTitle>
          <Badge variant="success">{item.content_layer}</Badge>
        </div>
        {item.difficulty_level && <CardDescription>{item.difficulty_level}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <p className="text-sm leading-relaxed">{contentPreview(item)}</p>
        {detail && <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function FocusedEducationPanel({ drug }: { drug: string }) {
  const educationQuery = useDrugEducation(drug);
  const flashcardsQuery = useDrugFlashcards(drug);
  const education = educationQuery.data?.data ?? [];
  const flashcards = flashcardsQuery.data?.data ?? [];
  const loading = educationQuery.isLoading || flashcardsQuery.isLoading;
  const error = educationQuery.error || flashcardsQuery.error;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-md">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4" />
                Focused education content
              </CardTitle>
              <CardDescription>Draft content for slugs, published content for UUIDs.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/knowledge/drugs/${encodeURIComponent(drug)}`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading education content...</p>
          ) : error ? (
            <p className="text-sm text-destructive">Unable to load education content.</p>
          ) : education.length === 0 ? (
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              No education content yet. Open the Drug Editor and fill the Education section.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {education.map((item) => (
                <EducationItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-4 w-4" />
            Flashcards
          </CardTitle>
          <CardDescription>Student-app ready card feed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading flashcards...</p>
          ) : flashcards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flashcards yet.</p>
          ) : (
            flashcards.map((card) => (
              <div key={card.id} className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Front</p>
                <p className="mt-1 text-sm">{card.front}</p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">Back</p>
                <p className="mt-1 text-sm">{card.back}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EducationSurface() {
  const searchParams = useSearchParams();
  const focusedDrug = searchParams.get("drug");

  return (
    <div className="space-y-6">
      <KnowledgeSurface
        eyebrow="Education layer"
        title="Education"
        status="MVP live"
        description="Education content is a separate layer from biomedical facts. Drug Editor now supports summaries, pearls, mnemonics, common mistakes, and flashcards, with education validation in the publish path."
        primary={{
          label: focusedDrug ? "Edit education" : "Open validation",
          href: focusedDrug ? `/knowledge/drugs/${encodeURIComponent(focusedDrug)}` : "/validation",
          icon: focusedDrug ? Pencil : BookOpen,
          description: focusedDrug
            ? "Open the focused Drug Editor education section."
            : "Review education and evidence blockers before publish.",
        }}
        signals={[
          { label: "Layer separation", value: "documented", tone: "success" },
          { label: "Drug education API", value: "MVP live", tone: "success" },
          { label: "Editor mode", value: "Drug Editor", tone: "success" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "Dedicated global education manager",
          "Case-based teaching endpoints",
          "Mechanism-linked teaching diagrams",
        ]}
      />
      {focusedDrug && <FocusedEducationPanel drug={focusedDrug} />}
    </div>
  );
}
