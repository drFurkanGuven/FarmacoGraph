"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PropertyEditorFieldType = "text" | "textarea" | "number" | "readonly";

export interface PropertyEditorField {
  /** Unique field key */
  key: string;
  /** Display label */
  label: string;
  /** Current value */
  value: string | number;
  /** Input type — readonly renders static text */
  type?: PropertyEditorFieldType;
  /** Optional helper text below the field */
  description?: string;
  /** Placeholder for editable fields */
  placeholder?: string;
}

export interface PropertyEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section title */
  title?: string;
  /** Fields to render */
  fields: PropertyEditorField[];
  /** Called when an editable field value changes */
  onFieldChange?: (key: string, value: string) => void;
  /** Disable all editable inputs */
  disabled?: boolean;
}

/**
 * Generic key-value property editor for entity detail panels.
 * Pass field definitions and handle changes via `onFieldChange`.
 */
function PropertyEditor({
  title,
  fields,
  onFieldChange,
  disabled = false,
  className,
  ...props
}: PropertyEditorProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {title && <h4 className="text-sm font-medium leading-none">{title}</h4>}
      <dl className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`property-${field.key}`} className="text-muted-foreground">
              {field.label}
            </Label>
            {field.type === "readonly" ? (
              <dd className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono">{field.value}</dd>
            ) : field.type === "textarea" ? (
              <Textarea
                id={`property-${field.key}`}
                value={String(field.value)}
                placeholder={field.placeholder}
                disabled={disabled}
                onChange={(e) => onFieldChange?.(field.key, e.target.value)}
              />
            ) : (
              <Input
                id={`property-${field.key}`}
                type={field.type === "number" ? "number" : "text"}
                value={field.value}
                placeholder={field.placeholder}
                disabled={disabled}
                onChange={(e) => onFieldChange?.(field.key, e.target.value)}
              />
            )}
            {field.description && <p className="text-[0.8rem] text-muted-foreground">{field.description}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}

export { PropertyEditor };
