import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from 'lucide-react';

interface TriggerNodeData {
  label: string;
  triggerType: string;
  conditions?: Record<string, any>;
}

interface TriggerNodeProps {
  data: TriggerNodeData;
  selected?: boolean;
}

const getTriggerLabel = (triggerType: string) => {
  const labels = {
    session_scheduled: 'Session Scheduled',
    session_confirmed: 'Session Confirmed',
    session_completed: 'Session Completed',
    session_cancelled: 'Session Cancelled',
    session_rescheduled: 'Session Rescheduled',
    project_status_change: 'Project Status Changed',
    lead_status_change: 'Lead Status Changed',
  };
  return labels[triggerType as keyof typeof labels] || triggerType;
};

export const TriggerNode = memo(({ data, selected }: TriggerNodeProps) => {
  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-blue-100 dark:bg-blue-900/20 rounded">
            <Zap className="h-4 w-4 text-blue-600" />
          </div>
          <span className="font-medium text-sm">Trigger</span>
        </div>
        
        <Badge variant="secondary" className="text-xs">
          {getTriggerLabel(data.triggerType)}
        </Badge>
        
        {Object.keys(data.conditions || {}).length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            With conditions
          </div>
        )}
      </CardContent>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </Card>
  );
});