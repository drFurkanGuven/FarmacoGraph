"use client";

import { PathwayEditor } from "./pathway-editor";
import type { DrugPublishPackage } from "./types";

export interface MechanismSectionProps {
  pkg: DrugPublishPackage;
  drugId: string;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

export function MechanismSection({
  pkg,
  drugId,
  disabled = false,
  onPackageChange,
}: MechanismSectionProps) {
  const drugEntityId = String(pkg.entity_payload.id ?? drugId);

  return (
    <div className="max-w-5xl space-y-4">
      <PathwayEditor
        pkg={pkg}
        drugEntityId={drugEntityId}
        disabled={disabled}
        onPackageChange={onPackageChange}
      />
    </div>
  );
}
