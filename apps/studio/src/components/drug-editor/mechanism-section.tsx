"use client";

import { MechanismPicker } from "./mechanism-picker";
import { listMechanismRootIds, syncMechanismRootSelection } from "./mechanism-roots";
import type { DrugPublishPackage } from "./types";

export interface MechanismSectionProps {
  pkg: DrugPublishPackage;
  disabled?: boolean;
  onPackageChange: (next: DrugPublishPackage) => void;
}

export function MechanismSection({ pkg, disabled = false, onPackageChange }: MechanismSectionProps) {
  const selectedIds = listMechanismRootIds(pkg);

  return (
    <div className="max-w-2xl space-y-4">
      <MechanismPicker
        selectedIds={selectedIds}
        disabled={disabled}
        onChange={(nextIds) => onPackageChange(syncMechanismRootSelection(pkg, nextIds))}
      />
      <p className="text-xs text-muted-foreground">
        Full pathway DAG editing remains deferred. Selecting roots here is enough for publish and the
        Mechanisms / Graph preview surfaces.
      </p>
    </div>
  );
}
