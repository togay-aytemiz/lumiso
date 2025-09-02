import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent } from "@/components/ui/card";
import { GitBranch } from 'lucide-react';

interface ConditionNodeData {
  label: string;
  field: string;
  operator: string;
  value: string;
}

interface ConditionNodeProps {
  data: ConditionNodeData;
  selected?: boolean;
}

export const ConditionNode = memo(({ data, selected }: ConditionNodeProps) => {
  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
      
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-purple-100 dark:bg-purple-900/20 rounded">
            <GitBranch className="h-4 w-4 text-purple-600" />
          </div>
          <span className="font-medium text-sm">Condition</span>
        </div>
        
        {data.field && data.operator && data.value ? (
          <div className="text-xs bg-muted p-2 rounded">
            <span className="font-mono">
              {data.field} {data.operator} "{data.value}"
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Click to configure condition
          </div>
        )}
      </CardContent>
      
      <Handle
        id="true"
        type="source"
        position={Position.Bottom}
        style={{ left: '25%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        id="false"
        type="source"
        position={Position.Bottom}
        style={{ left: '75%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
      
      <div className="absolute bottom-[-20px] left-0 w-full flex justify-between text-xs text-muted-foreground px-4">
        <span>True</span>
        <span>False</span>
      </div>
    </Card>
  );
});