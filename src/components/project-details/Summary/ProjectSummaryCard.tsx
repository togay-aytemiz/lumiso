import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";

interface ProjectSummaryCardProps {
  projectId: string;
  name: string;
  projectTypeName?: string | null;
  statusId?: string | null;
  onStatusChange?: () => void;
}

export default function ProjectSummaryCard({ projectId, name, projectTypeName, statusId, onStatusChange }: ProjectSummaryCardProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-base font-semibold leading-tight">{name}</h3>
          <ProjectStatusBadge 
            projectId={projectId} 
            currentStatusId={statusId}
            onStatusChange={onStatusChange}
            editable={true}
            className="text-xs"
          />
          {projectTypeName && (
            <Badge variant="outline" className="text-[10px]">{projectTypeName.toUpperCase()}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
