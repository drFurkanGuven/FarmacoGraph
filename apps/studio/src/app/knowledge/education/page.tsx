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
        status="MVP live"
        description="Education content is a separate layer from biomedical facts. Drug Editor now supports summaries, pearls, mnemonics, common mistakes, and flashcards, with education validation in the publish path."
        primary={{
          label: "Open validation",
          href: "/validation",
          icon: BookOpen,
          description: "Review education and evidence blockers before publish.",
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
    </Suspense>
  );
}
