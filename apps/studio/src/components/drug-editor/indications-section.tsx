"use client";

import { useMemo } from "react";
import { useCuratorDiseases } from "@/lib/api/react-query/hooks";
import { useLanguage } from "@/lib/i18n/context";
import { DiseasePicker } from "./disease-picker";
import { TreatsIndicationCard } from "./treats-indication-card";
import {
  listTreatsDiseaseIds,
  readTreatsIndication,
  syncTreatsSelection,
  updateTreatsIndication,
} from "./treats-relationships";
import { readCuratorAttestationFromPackage } from "./treats-indication-status";
import { useDrugEvidence } from "./use-drug-evidence";
import type { DrugPublishPackage } from "./types";
import type { ValidationResult } from "@/lib/api";

export interface IndicationsSectionProps {
  pkg: DrugPublishPackage;
  drugId: string;
  slug: string | null;
  validation: ValidationResult | null;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

export function IndicationsSection({
  pkg,
  drugId,
  slug,
  validation,
  disabled = false,
  onPackageChange,
}: IndicationsSectionProps) {
  const { t } = useLanguage();
  const drugEntityId = String(pkg.entity_payload.id ?? drugId);
  const selectedIds = listTreatsDiseaseIds(pkg);
  const catalogQuery = useCuratorDiseases({ limit: 200 });
  const curatorAttestation = readCuratorAttestationFromPackage(
    pkg.entity_payload.provenance as Record<string, unknown> | undefined
  );

  const evidence = useDrugEvidence({
    drugId,
    entityId: drugEntityId,
    slug,
    validation,
  });

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
    patch: Parameters<typeof updateTreatsIndication>[3]
  ) {
    onPackageChange(updateTreatsIndication(pkg, drugEntityId, diseaseId, patch));
  }

  async function handleQuickCreate(diseaseId: string, title: string) {
    const created = await evidence.createAndAttachEvidence({
      title,
      evidence_type: "pubmed_article",
      quality_score: 0.5,
      year: null,
      extract: null,
    });
    const current = readTreatsIndication(pkg, drugEntityId, diseaseId).evidence_ids ?? [];
    if (!current.includes(created.id)) {
      onPackageChange(
        updateTreatsIndication(pkg, drugEntityId, diseaseId, {
          evidence_ids: [...current, created.id],
        })
      );
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <DiseasePicker
        selectedIds={selectedIds}
        disabled={disabled}
        onChange={handleSelectionChange}
      />

      {selectedIds.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">
              {t("treats.indicationMetadata", "Indication metadata")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                "treats.clinicalExplanationHint",
                "Required for publish validation (FG-C012 / FG-C019 / FG-C020). Set Provenance attestation to true when using expert consensus, or link attached evidence per indication."
              )}
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
                curatorAttestation={curatorAttestation}
                attachments={evidence.attachments}
                evidenceLoading={evidence.loading}
                disabled={disabled}
                onChange={(patch) => handleIndicationChange(diseaseId, patch)}
                onQuickCreate={(title) => handleQuickCreate(diseaseId, title)}
                quickCreatePending={evidence.isMutating}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
