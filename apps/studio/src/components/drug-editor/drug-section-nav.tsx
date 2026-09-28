"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage, useSectionText } from "@/lib/i18n/context";
import { DRUG_EDITOR_SECTIONS } from "./sections";

export interface DrugSectionNavProps {
  activeSectionId: string;
  dirtySections: string[];
  onSelect: (sectionId: string) => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function DrugSectionNav({
  activeSectionId,
  dirtySections,
  onSelect,
  className,
  orientation = "vertical",
}: DrugSectionNavProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <ScrollArea className={cn("minimal-scrollbar", isHorizontal ? "w-full" : "h-full", className)}>
      <nav
        className={cn(
          "gap-1",
          isHorizontal ? "flex w-max min-w-full px-1 pb-1" : "flex flex-col p-2"
        )}
        aria-label="Drug editor sections"
      >
        {DRUG_EDITOR_SECTIONS.map((section) => (
          <SectionNavButton
            key={section.id}
            sectionId={section.id}
            title={section.title}
            isActive={section.id === activeSectionId}
            isDirty={dirtySections.includes(section.id)}
            isHorizontal={isHorizontal}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </ScrollArea>
  );
}

function SectionNavButton({
  sectionId,
  title,
  isActive,
  isDirty,
  isHorizontal,
  onSelect,
}: {
  sectionId: string;
  title: string;
  isActive: boolean;
  isDirty: boolean;
  isHorizontal: boolean;
  onSelect: (sectionId: string) => void;
}) {
  const { title: label } = useSectionText({ id: sectionId, title });
  const { t } = useLanguage();
  return (
    <Button
      type="button"
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "justify-start",
        isHorizontal ? "shrink-0" : "w-full",
        isActive && "font-medium"
      )}
      onClick={() => onSelect(sectionId)}
    >
      <span>{label}</span>
      {isDirty && (
        <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-500">
          {t("nav.edited", "Edited")}
        </span>
      )}
    </Button>
  );
}
