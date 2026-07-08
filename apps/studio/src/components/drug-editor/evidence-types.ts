import type { ValidationResult } from "@/lib/api";

/** Evidence node summary returned by the evidence API. */
export interface EvidenceItem {
  id: string;
  evidence_type: string;
  title: string;
  quality_score: number;
  year?: number | null;
  status?: string | null;
  extract?: string | null;
}

/** Link between a drug and an evidence node. */
export interface DrugEvidenceAttachment {
  evidence_id: string;
  evidence: EvidenceItem;
  attached_at?: string | null;
  relationship_type?: string | null;
  target_id?: string | null;
}

export interface DrugEvidenceState {
  attachments: DrugEvidenceAttachment[];
  missing_requirements: MissingEvidenceRequirement[];
}

export interface MissingEvidenceRequirement {
  id: string;
  message: string;
  field?: string | null;
  relationship_type?: string | null;
  constraint_id?: string | null;
}

export type EvidenceQualityLevel = "high" | "medium" | "low" | "none";

export interface DrugEvidenceSummary {
  attachedCount: number;
  missingCount: number;
  averageQuality: number | null;
  qualityLevel: EvidenceQualityLevel;
  lowQualityCount: number;
}

export interface CreateEvidenceInput {
  title: string;
  evidence_type: string;
  quality_score: number;
  year?: number | null;
  extract?: string | null;
}

export interface DrugEvidenceContext {
  drugId: string;
  entityId: string;
  slug: string | null;
  validation: ValidationResult | null;
}
