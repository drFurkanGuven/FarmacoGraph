"use client";

import { Suspense } from "react";
import { Network } from "lucide-react";
import { KnowledgeSurface, commonKnowledgeLinks } from "@/components/knowledge/knowledge-surface";

export default function GraphPage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeSurface
        eyebrow="Graph explorer"
        title="Graph Explorer"
        status="Preview surface"
        description="The graph explorer is connected to the curation workflow as a navigation surface. Heavy interactive expansion remains deferred until graph query endpoints are stable."
        primary={{
          label: "Open evidence",
          href: "/knowledge/evidence",
          icon: Network,
          description: "Review the evidence layer that will support graph assertions.",
        }}
        signals={[
          { label: "Graph write", value: "publish path", tone: "success" },
          { label: "Graph query API", value: "planned", tone: "warning" },
          { label: "Interactive canvas", value: "deferred", tone: "muted" },
        ]}
        links={commonKnowledgeLinks}
        deferred={[
          "Drug-centered graph neighborhood endpoint",
          "Interactive Cytoscape/React Flow explorer",
          "Path highlighting and relationship diff views",
        ]}
      />
    </Suspense>
  );
}
