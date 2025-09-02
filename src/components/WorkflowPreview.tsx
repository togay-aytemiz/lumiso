import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Workflow } from "@/types/workflow";
import { Mail, MessageSquare, Phone, Clock, Zap, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface WorkflowPreviewProps {
  workflow: Workflow;
  triggerData?: Record<string, any>;
}

export function WorkflowPreview({ workflow, triggerData }: WorkflowPreviewProps) {
  const getTriggerLabel = (triggerType: string) => {
    const labels = {
      session_scheduled: 'Session Scheduled',
      session_confirmed: 'Session Confirmed',
      session_completed: 'Session Completed',
      session_cancelled: 'Session Cancelled',
      session_rescheduled: 'Session Rescheduled',
      project_status_change: 'Project Status Change',
      lead_status_change: 'Lead Status Change',
    };
    return labels[triggerType as keyof typeof labels] || triggerType;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'whatsapp':
        return <Phone className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  // Mock workflow steps for preview
  const mockSteps = [
    {
      id: 'step-1',
      type: 'notification',
      name: 'Send Confirmation',
      channels: ['email', 'sms'],
      delay: 0,
      template: 'Session Confirmation Template'
    },
    {
      id: 'step-2', 
      type: 'notification',
      name: 'Send Reminder',
      channels: ['whatsapp'],
      delay: 1440, // 24 hours
      template: 'Session Reminder Template'
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Preview Workflow
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workflow Preview: {workflow.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Workflow Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Trigger Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {getTriggerLabel(workflow.trigger_type)}
                </span>
                <Badge variant={workflow.is_active ? "default" : "secondary"}>
                  {workflow.is_active ? "Active" : "Paused"}
                </Badge>
              </div>
              {workflow.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {workflow.description}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Workflow Steps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Workflow Steps
            </h3>
            
            {mockSteps.map((step, index) => (
              <Card key={step.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Step Number */}
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{step.name}</h4>
                        {step.delay > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {step.delay >= 1440 ? `${step.delay / 1440}d` : `${step.delay}m`} delay
                          </div>
                        )}
                      </div>
                      
                      {/* Channels */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Channels:</span>
                        {step.channels.map((channel) => (
                          <div
                            key={channel}
                            className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs"
                          >
                            {getChannelIcon(channel)}
                            <span className="capitalize">{channel}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Template */}
                      <div className="text-xs text-muted-foreground">
                        Template: <span className="font-medium">{step.template}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                
                {/* Connection Line */}
                {index < mockSteps.length - 1 && (
                  <div className="absolute left-8 bottom-0 w-px h-4 bg-border transform translate-y-full" />
                )}
              </Card>
            ))}
          </div>

          {/* Summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Workflow Summary</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• {mockSteps.length} notifications will be sent</p>
                <p>• Across {new Set(mockSteps.flatMap(s => s.channels)).size} communication channels</p>
                <p>• Total duration: ~24 hours</p>
              </div>
            </CardContent>
          </Card>
          
          {triggerData && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sample Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-mono bg-muted p-2 rounded">
                  {JSON.stringify(triggerData, null, 2)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}