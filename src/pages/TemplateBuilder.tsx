import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, Send, Save } from "lucide-react";
import { TemplateEditor } from "@/components/template-builder/TemplateEditor";
import { TemplatePreview } from "@/components/template-builder/TemplatePreview";
import { TemplateBlock } from "@/types/templateBuilder";

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const [templateName, setTemplateName] = useState("New Template");
  const [isDraft, setIsDraft] = useState(true);
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);
  const [activePreviewChannel, setActivePreviewChannel] = useState<"email" | "whatsapp" | "sms">("email");

  const handleSaveTemplate = () => {
    console.log("Saving template:", { templateName, blocks, isDraft });
    // TODO: Implement save functionality
  };

  const handleTestSend = () => {
    console.log("Test sending template:", { templateName, blocks, channel: activePreviewChannel });
    // TODO: Implement test send functionality
  };

  const handlePublishTemplate = () => {
    setIsDraft(false);
    handleSaveTemplate();
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
              <span className="text-xs bg-muted px-2 py-1 rounded">
                {isDraft ? "Draft" : "Published"}
              </span>
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
          />
        </div>
      </div>
    </div>
  );
}