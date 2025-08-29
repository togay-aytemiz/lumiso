import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, Send, Save } from "lucide-react";
import { TemplateEditor } from "@/components/template-builder/TemplateEditor";
import { TemplatePreview } from "@/components/template-builder/TemplatePreview";
import { VariablePicker } from "@/components/template-builder/VariablePicker";
import { TemplateBlock } from "@/types/templateBuilder";
import { useToast } from "@/hooks/use-toast";

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templateName, setTemplateName] = useState("New Template");
  const [emailSubject, setEmailSubject] = useState("Your photography session is confirmed!");
  const [isDraft, setIsDraft] = useState(true);
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);
  const [activePreviewChannel, setActivePreviewChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save functionality
  const saveTemplate = useCallback(() => {
    const templateData = {
      name: templateName,
      emailSubject,
      blocks,
      isDraft,
      updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage for now (in real app, this would be an API call)
    localStorage.setItem('template-draft', JSON.stringify(templateData));
    setLastSaved(new Date());
    
    console.log("Auto-saving template:", templateData);
  }, [templateName, emailSubject, blocks, isDraft]);

  // Auto-save every 3 seconds when there are changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (templateName || emailSubject || blocks.length > 0) {
        saveTemplate();
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [templateName, emailSubject, blocks, saveTemplate]);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('template-draft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.name) setTemplateName(data.name);
        if (data.emailSubject) setEmailSubject(data.emailSubject);
        if (data.blocks) setBlocks(data.blocks);
        if (data.isDraft !== undefined) setIsDraft(data.isDraft);
        setLastSaved(new Date(data.updatedAt));
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, []);

  const handleSaveTemplate = () => {
    saveTemplate();
    toast({
      title: "Template saved",
      description: "Your template has been saved successfully.",
    });
  };

  const handleTestSend = () => {
    console.log("Test sending template:", { templateName, emailSubject, blocks, channel: activePreviewChannel });
    toast({
      title: "Test message sent",
      description: `Test ${activePreviewChannel} sent successfully.`,
    });
  };

  const handlePublishTemplate = () => {
    setIsDraft(false);
    saveTemplate();
    toast({
      title: "Template published",
      description: "Your template is now live and ready to use.",
    });
  };

  const insertVariableInSubject = (variable: string) => {
    const cursorPos = 0; // In a real implementation, you'd track cursor position
    const newSubject = emailSubject.slice(0, cursorPos) + variable + emailSubject.slice(cursorPos);
    setEmailSubject(newSubject);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/templates')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="font-semibold text-lg border-none bg-transparent p-0 h-auto focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs bg-muted px-2 py-1 rounded">
                  {isDraft ? "Draft" : "Published"}
                </span>
                {lastSaved && (
                  <span className="text-xs text-muted-foreground">
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleTestSend}>
              <Send className="h-4 w-4" />
              Test Send
            </Button>
            <Button variant="outline" onClick={handleSaveTemplate}>
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            {isDraft && (
              <Button onClick={handlePublishTemplate}>
                <Eye className="h-4 w-4" />
                Publish
              </Button>
            )}
          </div>
        </div>

        {/* Email Subject Field */}
        {activePreviewChannel === "email" && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Label htmlFor="email-subject" className="text-sm font-medium min-w-fit">
                📧 Email Subject Line
              </Label>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Your photography session is confirmed!"
                  className="flex-1"
                />
                <VariablePicker 
                  onVariableSelect={insertVariableInSubject}
                  trigger={
                    <Button variant="outline" size="sm">
                      + Variable
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Side - Template Editor */}
        <div className="w-1/2 border-r">
          <TemplateEditor
            blocks={blocks}
            onBlocksChange={setBlocks}
          />
        </div>

        {/* Right Side - Live Preview */}
        <div className="w-1/2">
          <TemplatePreview
            blocks={blocks}
            activeChannel={activePreviewChannel}
            onChannelChange={setActivePreviewChannel}
            emailSubject={emailSubject}
          />
        </div>
      </div>
    </div>
  );
}