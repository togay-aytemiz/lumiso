import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent } from "@/components/ui/card";
import { Timer } from 'lucide-react';

interface DelayNodeData {
  label: string;
  duration: number;
  unit: 'minutes' | 'hours' | 'days';
}

interface DelayNodeProps {
  data: DelayNodeData;
  selected?: boolean;
}

export const DelayNode = memo(({ data, selected }: DelayNodeProps) => {
  const formatDuration = () => {
    const { duration, unit } = data;
    return `${duration} ${unit}${duration !== 1 ? '' : unit.slice(0, -1)}`;
  };

  return (
    <Card className={`min-w-[180px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
      
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-orange-100 dark:bg-orange-900/20 rounded">
            <Timer className="h-4 w-4 text-orange-600" />
          </div>
          <span className="font-medium text-sm">Wait</span>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-semibold text-orange-600">
            {formatDuration()}
          </div>
          <div className="text-xs text-muted-foreground">
            before continuing
          </div>
        </div>
      </CardContent>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
    </Card>
  );
});