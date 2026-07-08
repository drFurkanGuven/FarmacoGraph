"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { apiQueryKeys } from "@/lib/api/react-query/keys";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { loadCuratorDrugPackage, validateDrugPackage } from "./api";
import { ensureDraftWorkflow } from "./autosave";
import {
  AUTOSAVE_DEBOUNCE_MS,
  VALIDATION_DEBOUNCE_MS,
  clearDirtySection,
  createDebouncedFn,
  mergeDirtySections,
  saveDrugPackage,
} from "./autosave";
import { applyFieldChange, createEmptyDrugPackage } from "./package";
import { DEFAULT_SECTION_ID, getSectionById } from "./sections";
import type { DrugEditorSnapshot, DrugPublishPackage, SaveStatus } from "./types";

interface UseDrugEditorOptions {
  drugId: string;
}

export function useDrugEditor({ drugId }: UseDrugEditorOptions) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DrugEditorSnapshot>(() => ({
    drugId,
    workflow: null,
    package: createEmptyDrugPackage(drugId),
    activeSectionId: DEFAULT_SECTION_ID,
    saveStatus: "idle",
    saveError: null,
    lastSavedAt: null,
    lastSaveStrategy: null,
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
      createDebouncedFn(async (pkg: DrugPublishPackage) => {
        setSnapshot((current) => ({ ...current, validationPending: true }));
        try {
          const validation = await validateDrugPackage(client, pkg);
          setSnapshot((current) => ({
            ...current,
            validation,
            validationPending: false,
          }));
        } catch {
          setSnapshot((current) => ({ ...current, validationPending: false }));
        }
      }, VALIDATION_DEBOUNCE_MS),
    [client],
  );

  const runSave = useMemo(
    () =>
      createDebouncedFn(async (sectionId: string, pkg: DrugPublishPackage) => {
        setSnapshot((current) => ({ ...current, saveStatus: "saving", saveError: null }));

        try {
          let workflowId = workflowRef.current?.id ?? null;
          if (!workflowId) {
            workflowId = await ensureDraftWorkflow(client, drugId);
            const workflowEnvelope = await client.getWorkflow(workflowId);
            workflowRef.current = workflowEnvelope.data;
          }

          const result = await saveDrugPackage(client, drugId, workflowId, pkg);

          setSnapshot((current) => ({
            ...current,
            workflow: workflowRef.current,
            saveStatus: "saved",
            saveError: null,
            lastSavedAt: result.savedAt,
            lastSaveStrategy: result.strategy,
            dirtySections: clearDirtySection(current.dirtySections, sectionId),
          }));

          await queryClient.invalidateQueries({ queryKey: apiQueryKeys.drug(drugId) });
          await queryClient.invalidateQueries({ queryKey: apiQueryKeys.curatorQueue("draft") });
        } catch (error) {
          const message = error instanceof ApiError ? error.message : "Autosave failed";
          setSnapshot((current) => ({
            ...current,
            saveStatus: "error",
            saveError: message,
          }));
        }
      }, AUTOSAVE_DEBOUNCE_MS),
    [client, drugId, queryClient],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setLoadError(null);

      try {
        const loaded = await loadCuratorDrugPackage(client, drugId);
        const workflow = loaded.workflow;
        const pkg = loaded.package;

        if (cancelled) return;

        setSnapshot((current) => ({
          ...current,
          drugId,
          workflow,
          package: pkg,
          saveStatus: "idle",
          saveError: null,
          dirtySections: [],
          validation: null,
          validationPending: false,
        }));

        workflowRef.current = workflow;
        runValidation(pkg);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : "Failed to load drug editor";
        setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [client, drugId, runValidation]);

  useEffect(() => {
    return () => {
      runSave.cancel();
      runValidation.cancel();
    };
  }, [runSave, runValidation]);

  const setActiveSection = useCallback((sectionId: string) => {
    setSnapshot((current) => ({ ...current, activeSectionId: sectionId }));
  }, []);

  const updateField = useCallback(
    (sectionId: string, fieldKey: string, value: string) => {
      const section = getSectionById(sectionId);
      const field = section?.fields.find((entry) => entry.key === fieldKey);
      if (!field) return;

      setSnapshot((current) => {
        const nextPackage = applyFieldChange(current.package, field.path, value, field.type);
        packageRef.current = nextPackage;
        return {
          ...current,
          package: nextPackage,
          saveStatus: "pending" as SaveStatus,
          dirtySections: mergeDirtySections(current.dirtySections, sectionId),
        };
      });

      runValidation(packageRef.current);
      runSave(sectionId, packageRef.current);
    },
    [runSave, runValidation],
  );

  const retrySave = useCallback(() => {
    const sectionId = snapshot.dirtySections[0] ?? snapshot.activeSectionId;
    runSave.flush();
    if (!runSave.pending()) {
      void saveDrugPackage(client, drugId, workflowRef.current?.id ?? null, packageRef.current)
        .then((result) => {
          setSnapshot((current) => ({
            ...current,
            saveStatus: "saved",
            saveError: null,
            lastSavedAt: result.savedAt,
            lastSaveStrategy: result.strategy,
            dirtySections: clearDirtySection(current.dirtySections, sectionId),
          }));
        })
        .catch((error) => {
          const message = error instanceof ApiError ? error.message : "Autosave failed";
          setSnapshot((current) => ({ ...current, saveStatus: "error", saveError: message }));
        });
    }
  }, [client, drugId, runSave, snapshot.activeSectionId, snapshot.dirtySections]);

  const activeSection = getSectionById(snapshot.activeSectionId) ?? getSectionById(DEFAULT_SECTION_ID)!;

  return {
    loading,
    loadError,
    snapshot,
    activeSection,
    setActiveSection,
    updateField,
    retrySave,
  };
}
