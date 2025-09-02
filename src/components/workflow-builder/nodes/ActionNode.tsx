import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Phone } from 'lucide-react';

interface ActionNodeData {
  label: string;
  actionType: string;
  channels: string[];
  templateId?: string;
  delayMinutes?: number;
}

interface ActionNodeProps {
  data: ActionNodeData;
  selected?: boolean;
}

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case 'email':
      return <Mail className="h-3 w-3" />;
    case 'sms':
      return <MessageSquare className="h-3 w-3" />;
    case 'whatsapp':
      return <Phone className="h-3 w-3" />;
    default:
      return <Mail className="h-3 w-3" />;
  }
};

const getChannelColor = (channel: string) => {
  switch (channel) {
    case 'email':
      return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
    case 'sms':
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    case 'whatsapp':
      return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20';
    default:
      return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
  }
};

export const ActionNode = memo(({ data, selected }: ActionNodeProps) => {
  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-green-100 dark:bg-green-900/20 rounded">
            <Mail className="h-4 w-4 text-green-600" />
          </div>
          <span className="font-medium text-sm">Send Notification</span>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {data.channels.map((channel) => (
            <div
              key={channel}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${getChannelColor(channel)}`}
            >
              {getChannelIcon(channel)}
              <span className="capitalize">{channel}</span>
            </div>
          ))}
        </div>
        
        {data.delayMinutes && data.delayMinutes > 0 && (
          <Badge variant="outline" className="text-xs">
            {data.delayMinutes}m delay
          </Badge>
        )}
        
        {data.templateId && (
          <div className="mt-1 text-xs text-muted-foreground truncate">
            Template: {data.templateId}
          </div>
        )}
      </CardContent>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </Card>
  );
});