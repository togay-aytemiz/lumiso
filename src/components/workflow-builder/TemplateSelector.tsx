import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTemplates } from "@/hooks/useTemplates";
import { Search, Mail, MessageSquare, Phone, FileText } from "lucide-react";

interface TemplateSelectorProps {
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string, templateName: string) => void;
  channels?: ('email' | 'sms' | 'whatsapp')[];
  children?: React.ReactNode;
}

export function TemplateSelector({ 
  selectedTemplateId, 
  onTemplateSelect, 
  channels = ['email'], 
  children 
}: TemplateSelectorProps) {
  const { templates, loading } = useTemplates();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChannel, setActiveChannel] = useState<string>(channels[0] || 'email');

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'whatsapp':
        return <Phone className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFilteredTemplates = (channel: string) => {
    let channelTemplates = [];
    
    switch (channel) {
      case 'email':
        channelTemplates = templates.filter(t => 
          t.category === 'email' || 
          t.category === 'session_confirmation' ||
          t.category === 'messages'
        );
        break;
      case 'sms':
      case 'whatsapp':
        channelTemplates = templates.filter(t => 
          t.category === 'messages' || 
          t.category.includes('session')
        );
        break;
      default:
        channelTemplates = templates;
    }

    if (searchQuery) {
      channelTemplates = channelTemplates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.master_content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return channelTemplates;
  };

  const handleTemplateSelect = (templateId: string, templateName: string) => {
    onTemplateSelect(templateId, templateName);
    setOpen(false);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="w-full justify-start">
            {selectedTemplate ? (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="truncate">{selectedTemplate.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-muted-foreground">Select template...</span>
              </div>
            )}
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Channel Tabs */}
          {channels.length > 1 && (
            <Tabs value={activeChannel} onValueChange={setActiveChannel}>
              <TabsList className="grid w-full grid-cols-3">
                {channels.map((channel) => (
                  <TabsTrigger key={channel} value={channel} className="flex items-center gap-2">
                    {getChannelIcon(channel)}
                    <span className="capitalize">{channel}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Templates List */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {getFilteredTemplates(activeChannel).map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedTemplateId === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleTemplateSelect(template.id, template.name)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium">
                          {template.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.master_content || template.master_subject || 'No content preview'}
                      </p>
                      {Array.isArray(template.placeholders) && template.placeholders.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {template.placeholders.slice(0, 3).map((placeholder, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {placeholder.replace(/[{}]/g, '')}
                            </Badge>
                          ))}
                          {template.placeholders.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.placeholders.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {getFilteredTemplates(activeChannel).length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      No templates found for {activeChannel}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}