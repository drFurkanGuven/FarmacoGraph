"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiClient } from "@/lib/hooks/use-api-client";
import {
  AUTOSAVE_DEBOUNCE_MS,
  VALIDATION_DEBOUNCE_MS,
  clearDirtySection,
  createDebouncedFn,
  mergeDirtySections,
} from "@/components/drug-editor/autosave";
import type { EntityEditorSnapshot } from "@/components/entity-editor";
import {
  formatDiseaseEditorLoadError,
  loadCuratorDiseasePackage,
  saveDiseasePackage,
  validateDiseasePackage,
} from "./api";
import { applyFieldChange, createEmptyDiseasePackage } from "./package";
import { DEFAULT_SECTION_ID, DISEASE_EDITOR_SECTIONS, getSectionById } from "./sections";
import type { DiseasePublishPackage } from "./sections";

export function useDiseaseEditor({ diseaseSlug }: { diseaseSlug: string }) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EntityEditorSnapshot>(() => ({
    entityKey: diseaseSlug,
    entityType: "Disease",
    workflow: null,
    package: createEmptyDiseasePackage(diseaseSlug),
    activeSectionId: DEFAULT_SECTION_ID,
    saveStatus: "idle",
    saveError: null,
    lastSavedAt: null,
    dirtySections: [],
    validation: null,
    validationPending: false,
  }));

  const packageRef = useRef(snapshot.package);
  const workflowRef = useRef(snapshot.workflow);
  packageRef.current = snapshot.package;
  workflowRef.current = snapshot.workflow;

  const runValidation = useMemo(
    () =>
      createDebouncedFn(async (pkg: DiseasePublishPackage) => {
        setSnapshot((current) => ({ ...current, validationPending: true }));
        try {
          const validation = await validateDiseasePackage(client, pkg);
          setSnapshot((current) => ({ ...current, validation, validationPending: false }));
        } catch {
          setSnapshot((current) => ({ ...current, validationPending: false }));
        }
      }, VALIDATION_DEBOUNCE_MS),
    [client],
  );

  const runSave = useMemo(
    () =>
      createDebouncedFn(async (sectionId: string, pkg: DiseasePublishPackage) => {
        setSnapshot((current) => ({ ...current, saveStatus: "saving", saveError: null }));
        try {
          const workflowId = workflowRef.current?.id;
          if (!workflowId) throw new Error("Workflow not initialized.");
          const result = await saveDiseasePackage(client, workflowId, pkg);
          setSnapshot((current) => ({
            ...current,
            saveStatus: "saved",
            saveError: null,
            lastSavedAt: result.savedAt,
            validation: result.validation ?? current.validation,
            dirtySections: clearDirtySection(current.dirtySections, sectionId),
          }));
          await queryClient.invalidateQueries({ queryKey: apiQueryKeys.diseasePackage(diseaseSlug) });
        } catch (error) {
          setSnapshot((current) => ({
            ...current,
            saveStatus: "error",
            saveError: error instanceof Error ? error.message : "Save failed.",
          }));
        }
      }, AUTOSAVE_DEBOUNCE_MS),
    [client, diseaseSlug, queryClient],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const loaded = await loadCuratorDiseasePackage(client, diseaseSlug);
        if (cancelled) return;
        workflowRef.current = loaded.workflow;
        setSnapshot((current) => ({
          ...current,
          entityKey: diseaseSlug,
          workflow: loaded.workflow,
          package: loaded.package as DiseasePublishPackage,
          validation: loaded.validation,
          saveStatus: "idle",
          dirtySections: [],
        }));
      } catch (error) {
        if (!cancelled) setLoadError(formatDiseaseEditorLoadError(error, diseaseSlug));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [client, diseaseSlug]);

  const setActiveSection = useCallback((sectionId: string) => {
    setSnapshot((current) => ({ ...current, activeSectionId: sectionId }));
  }, []);

  const onFieldChange = useCallback(
    (fieldPath: string, value: string) => {
      setSnapshot((current) => {
        const nextPackage = applyFieldChange(current.package as DiseasePublishPackage, fieldPath, value);
        const section = getSectionById(current.activeSectionId);
        const dirtySections = mergeDirtySections(current.dirtySections, section.id);
        void runSave(section.id, nextPackage);
        void runValidation(nextPackage);
        return {
          ...current,
          package: nextPackage,
          saveStatus: "saving",
          dirtySections,
        };
      });
    },
    [runSave, runValidation],
  );

  const activeSection = getSectionById(snapshot.activeSectionId);

  const onWorkflowUpdated = useCallback((workflow: NonNullable<typeof snapshot.workflow>) => {
    workflowRef.current = workflow;
    setSnapshot((current) => ({ ...current, workflow }));
  }, []);

  return {
    loading,
    loadError,
    snapshot,
    activeSection,
    sections: DISEASE_EDITOR_SECTIONS,
    setActiveSection,
    onFieldChange,
    onWorkflowUpdated,
  };
}
