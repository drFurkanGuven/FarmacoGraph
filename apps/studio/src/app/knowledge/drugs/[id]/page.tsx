import { DrugEditorWorkspace } from "@/components/drug-editor";

interface DrugEditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function DrugEditorPage({ params }: DrugEditorPageProps) {
  const { id } = await params;
  return <DrugEditorWorkspace drugId={id} />;
}
