import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhaseBadge } from "@/components/badges";

interface PlaceholderPageProps {
  title: string;
  description: string;
  phase: string;
}

export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <PhaseBadge phase={phase} />
      </div>
      <p className="text-muted-foreground">{description}</p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module not implemented yet</CardTitle>
          <CardDescription>
            The secure drug curation path is live. Disease authoring is rolling out; other modules ship in later milestones.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          All data operations will use the public FarmacoGraph API. Curators will not edit JSON files manually.
        </CardContent>
      </Card>
    </div>
  );
}
