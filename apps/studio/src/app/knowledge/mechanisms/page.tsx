"use client";

"use client";

import { Suspense } from "react";
import { GitBranch } from "lucide-react";
import { KnowledgeSurface, commonKnowledgeLinks } from "@/components/knowledge/knowledge-surface";

export default function MechanismsPage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeSurface
        eyebrow="Mechanism layer"
        title="Mechanisms"
        status="Editor deferred"
        description="Mechanism fields are curated through the Drug Editor today. A dedicated DAG editor should wait for stable mechanism contracts and assertion-level evidence UI."
        primary={{
          label: "Open graph context",
          href: "/graph",
          icon: GitBranch,
          description: "Inspect the graph surface state before adding an editor.",
        }}
        signals={[
          { label: "Drug mechanism fields", value: "live", tone: "success" },
          { label: "Mechanism DAG editor", value: "planned", tone: "warning" },
          { label: "Edge evidence UI", value: "deferred", tone: "muted" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "Mechanism fragment API contracts",
          "React Flow DAG editor with validation-safe writes",
          "Assertion-level SUPPORTED_BY evidence attachment",
        ]}
      />
    </Suspense>
  );
}
