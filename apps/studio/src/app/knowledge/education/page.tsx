"use client";

"use client";

import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { KnowledgeSurface, commonKnowledgeLinks } from "@/components/knowledge/knowledge-surface";

export default function EducationPage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeSurface
        eyebrow="Education layer"
        title="Education"
        status="Read-only surface"
        description="Education content is a separate layer from biomedical facts. This page links the live Drug Editor, evidence checks, and validation while the education CRUD API is still planned."
        primary={{
          label: "Open validation",
          href: "/validation",
          icon: BookOpen,
          description: "Review education and evidence blockers before publish.",
        }}
        signals={[
          { label: "Layer separation", value: "documented", tone: "success" },
          { label: "Drug education API", value: "planned", tone: "warning" },
          { label: "Editor mode", value: "deferred", tone: "muted" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "GET /drugs/{id}/education read contract",
          "Education draft editing for FiveSecondSummary and BoardExamPearl",
          "Publish package coverage and education validation gates",
        ]}
      />
    </Suspense>
  );
}
