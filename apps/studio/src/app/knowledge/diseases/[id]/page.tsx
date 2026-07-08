import { DiseaseEditorWorkspace } from "@/components/disease-editor";

interface DiseaseEditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function DiseaseEditorPage({ params }: DiseaseEditorPageProps) {
  const { id } = await params;
  return <DiseaseEditorWorkspace diseaseSlug={id} />;
}
