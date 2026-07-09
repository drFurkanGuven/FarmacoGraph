"use client";

import { useMemo } from "react";
import { useCuratorDiseases } from "@/lib/api/react-query/hooks";
import { DiseasePicker } from "./disease-picker";
import { TreatsIndicationCard } from "./treats-indication-card";
import {
  listTreatsDiseaseIds,
  readTreatsIndication,
  syncTreatsSelection,
  updateTreatsIndication,
} from "./treats-relationships";
import type { DrugPublishPackage } from "./types";

export interface IndicationsSectionProps {
  pkg: DrugPublishPackage;
  drugId: string;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

export function IndicationsSection({
  pkg,
  drugId,
  disabled = false,
  onPackageChange,
}: IndicationsSectionProps) {
  const drugEntityId = String(pkg.entity_payload.id ?? drugId);
  const selectedIds = listTreatsDiseaseIds(pkg);
  const catalogQuery = useCuratorDiseases({ limit: 200 });

  const labelById = useMemo(() => {
    const map = new Map<string, { label: string; slug: string }>();
    for (const row of catalogQuery.data?.data ?? []) {
      map.set(row.entity_id, { label: row.label, slug: row.slug });
    }
    return map;
  }, [catalogQuery.data?.data]);

  function handleSelectionChange(nextIds: string[]) {
    onPackageChange(syncTreatsSelection(pkg, drugEntityId, nextIds));
  }

  function handleIndicationChange(
    diseaseId: string,
    patch: Parameters<typeof updateTreatsIndication>[3],
  ) {
    onPackageChange(updateTreatsIndication(pkg, drugEntityId, diseaseId, patch));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <DiseasePicker selectedIds={selectedIds} disabled={disabled} onChange={handleSelectionChange} />

      {selectedIds.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Indication metadata</h3>
            <p className="text-xs text-muted-foreground">
              Required for publish validation (FG-C012 / FG-C019 / FG-C020). Set Provenance attestation to
              true when using expert consensus.
            </p>
          </div>
          {selectedIds.map((diseaseId) => {
            const meta = labelById.get(diseaseId);
            return (
              <TreatsIndicationCard
                key={diseaseId}
                label={meta?.label ?? diseaseId}
                slug={meta?.slug}
                properties={readTreatsIndication(pkg, drugEntityId, diseaseId)}
                disabled={disabled}
                onChange={(patch) => handleIndicationChange(diseaseId, patch)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
