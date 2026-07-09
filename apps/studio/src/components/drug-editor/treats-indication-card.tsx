"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TREATS_EVIDENCE_LEVELS,
  type TreatsIndicationProperties,
} from "./treats-relationships";

export interface TreatsIndicationCardProps {
  label: string;
  slug?: string;
  properties: TreatsIndicationProperties;
  disabled?: boolean;
  onChange: (patch: Partial<TreatsIndicationProperties>) => void;
}

export function TreatsIndicationCard({
  label,
  slug,
  properties,
  disabled = false,
  onChange,
}: TreatsIndicationCardProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-card/40 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {slug ? <p className="text-xs text-muted-foreground">{slug}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Publish requires a clinical rationale, confidence metadata, and evidence level on each TREATS
          edge. Use expert consensus when you attest the link in Provenance without a separate citation.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`treats-explanation-${slug ?? label}`}>Clinical explanation</Label>
        <Textarea
          id={`treats-explanation-${slug ?? label}`}
          rows={3}
          disabled={disabled}
          placeholder="Why does this drug treat this condition?"
          value={properties.explanation}
          onChange={(event) => onChange({ explanation: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`treats-confidence-${slug ?? label}`}>Confidence score (0–1)</Label>
          <Input
            id={`treats-confidence-${slug ?? label}`}
            type="number"
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
            value={properties.confidence_score}
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value);
              onChange({
                confidence_score: Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0,
              });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`treats-evidence-level-${slug ?? label}`}>Evidence level</Label>
          <select
            id={`treats-evidence-level-${slug ?? label}`}
            disabled={disabled}
            value={properties.evidence_level}
            onChange={(event) => onChange({ evidence_level: event.target.value })}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {TREATS_EVIDENCE_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
