import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-apex-text-primary">{title}</h1>
        <Badge variant="accent">Fase 2</Badge>
      </div>
      <Card>
        <CardContent className="pt-5 text-sm text-apex-text-secondary">{description}</CardContent>
      </Card>
    </div>
  );
}
