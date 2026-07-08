import type { FarmacoGraphClient, PackageValidation, PublishPackageInput, WorkflowItem } from "@/lib/api";

export async function loadCuratorDiseasePackage(client: FarmacoGraphClient, slug: string) {
  const opened = await client.openDiseaseWorkflow(slug);
  return {
    workflow: opened.data.workflow,
    package: opened.data.package as PublishPackageInput,
    validation: opened.data.validation,
  };
}

export async function validateDiseasePackage(client: FarmacoGraphClient, pkg: PublishPackageInput) {
  const envelope = await client.validatePackage(pkg);
  return envelope.data;
}

export async function saveDiseasePackage(
  client: FarmacoGraphClient,
  workflowId: string,
  pkg: PublishPackageInput,
): Promise<{ validation: PackageValidation | null; savedAt: string }> {
  const envelope = await client.saveWorkflowPackage(workflowId, pkg);
  return {
    validation: envelope.data.validation,
    savedAt: new Date().toISOString(),
  };
}

export function formatDiseaseEditorLoadError(error: unknown, slug: string): string {
  if (error instanceof Error) return error.message;
  return `Unable to load disease editor for ${slug}.`;
}

export type LoadedDiseaseWorkflow = {
  workflow: WorkflowItem;
  package: PublishPackageInput;
  validation: PackageValidation;
};
