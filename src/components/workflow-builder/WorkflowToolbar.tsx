import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Mail, 
  Timer, 
  GitBranch, 
  Plus 
} from "lucide-react";

interface WorkflowToolbarProps {
  onAddNode: (type: string) => void;
}

export function WorkflowToolbar({ onAddNode }: WorkflowToolbarProps) {
  const nodeTypes = [
    {
      type: 'trigger',
      label: 'Trigger',
      icon: Zap,
      description: 'Start workflow when event occurs',
      color: 'text-blue-600'
    },
    {
      type: 'action',
      label: 'Action',
      icon: Mail,
      description: 'Send notification or perform action',
      color: 'text-green-600'
    },
    {
      type: 'condition',
      label: 'Condition',
      icon: GitBranch,
      description: 'Branch workflow based on conditions',
      color: 'text-purple-600'
    },
    {
      type: 'delay',
      label: 'Delay',
      icon: Timer,
      description: 'Wait before next step',
      color: 'text-orange-600'
    }
  ];

  return (
    <Card className="p-3 m-4 border-border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Add Node:</span>
        <Separator orientation="vertical" className="h-6" />
        
        {nodeTypes.map((node) => {
          const Icon = node.icon;
          return (
            <Button
              key={node.type}
              variant="outline"
              size="sm"
              onClick={() => onAddNode(node.type)}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <Icon className={`h-4 w-4 ${node.color}`} />
              <span>{node.label}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}