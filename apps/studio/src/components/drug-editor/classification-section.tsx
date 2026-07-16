"use client";

import { DrugClassPicker } from "./drug-class-picker";
import { listBelongsToClassIds, syncBelongsToSelection } from "./belongs-to-relationships";
import type { DrugPublishPackage } from "./types";

export interface ClassificationSectionProps {
  pkg: DrugPublishPackage;
  drugId: string;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

export function ClassificationSection({
  pkg,
  drugId,
  disabled = false,
  onPackageChange,
}: ClassificationSectionProps) {
  const drugEntityId = String(pkg.entity_payload.id ?? drugId);
  const selectedIds = listBelongsToClassIds(pkg);
  const moduleSlug =
    typeof pkg.entity_payload.module === "string" ? pkg.entity_payload.module : undefined;

  return (
    <div className="max-w-2xl">
      <DrugClassPicker
        selectedIds={selectedIds}
        module={moduleSlug}
        disabled={disabled}
        onChange={(nextIds, catalog) => {
          onPackageChange(syncBelongsToSelection(pkg, drugEntityId, nextIds, catalog));
        }}
      />
    </div>
  );
}
