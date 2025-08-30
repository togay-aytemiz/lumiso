import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, Send, Save, Edit3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TemplateEditor } from "@/components/template-builder/TemplateEditor";
import { TemplatePreview } from "@/components/template-builder/TemplatePreview";
import { VariablePicker } from "@/components/template-builder/VariablePicker";
import { EmojiPicker } from "@/components/template-builder/EmojiPicker";
import { TemplateBlock } from "@/types/templateBuilder";
import { useToast } from "@/hooks/use-toast";
import { previewDataSets, getCharacterCount, checkSpamWords } from "@/lib/templateUtils";

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templateName, setTemplateName] = useState("New Template");
  const [emailSubject, setEmailSubject] = useState("Your photography session is confirmed!");
  const [preheader, setPreheader] = useState("We're excited to capture your special moments");
  const [isDraft, setIsDraft] = useState(true);
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);
  const [activePreviewChannel, setActivePreviewChannel] = useState<"email" | "whatsapp" | "sms" | "plaintext">("email");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [selectedPreviewData, setSelectedPreviewData] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);

  // Auto-save functionality
  const saveTemplate = useCallback(() => {
    const templateData = {
      name: templateName,
      emailSubject,
      preheader,
      blocks,
      isDraft,
      updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage for now (in real app, this would be an API call)
    localStorage.setItem('template-draft', JSON.stringify(templateData));
    setLastSaved(new Date());
    
    console.log("Auto-saving template:", templateData);
  }, [templateName, emailSubject, preheader, blocks, isDraft]);

  // Auto-save every 3 seconds when there are changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (templateName || emailSubject || preheader || blocks.length > 0) {
        saveTemplate();
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [templateName, emailSubject, preheader, blocks, saveTemplate]);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('template-draft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.name) setTemplateName(data.name);
        if (data.emailSubject) setEmailSubject(data.emailSubject);
        if (data.preheader) setPreheader(data.preheader);
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

  const insertVariableInPreheader = (variable: string) => {
    const cursorPos = 0; // In a real implementation, you'd track cursor position
    const newPreheader = preheader.slice(0, cursorPos) + variable + preheader.slice(cursorPos);
    setPreheader(newPreheader);
  };

  const insertEmojiInSubject = (emoji: string) => {
    setEmailSubject(prev => prev + emoji);
  };

  const handleNameEdit = () => {
    setIsEditingName(!isEditingName);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingName(false);
    }
  };

  const subjectCharCount = getCharacterCount(emailSubject);
  const spamWords = checkSpamWords(emailSubject);
  const selectedData = previewDataSets[selectedPreviewData];

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
              {isEditingName ? (
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={handleNameKeyDown}
                  className="font-semibold text-lg border bg-background px-2 py-1 h-auto focus-visible:ring-1"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{templateName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNameEdit}
                    className="h-6 w-6 p-0"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
            <Button variant="outline" onClick={handleTestSend}>
              <Send className="h-4 w-4" />
              Test Send
            </Button>
            <Button variant="outline" onClick={handleSaveTemplate}>
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button onClick={handlePublishTemplate}>
              <Eye className="h-4 w-4" />
              {isDraft ? "Publish" : "Published"}
            </Button>
          </div>
        </div>

        {/* Compact Email Settings */}
        {activePreviewChannel === "email" && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {/* Preview Data Selector - Inline */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Preview as:</Label>
                <Select value={selectedPreviewData.toString()} onValueChange={(value) => setSelectedPreviewData(parseInt(value))}>
                  <SelectTrigger className="w-36 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {previewDataSets.map((dataset, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {dataset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject Line - Compact */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="email-subject" className="text-xs font-medium text-muted-foreground">
                  📧 Subject
                </Label>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={subjectCharCount > 60 ? "text-amber-600" : ""}>
                    {subjectCharCount}/60
                  </span>
                  {subjectCharCount > 60 && <span className="text-amber-600">⚠️</span>}
                </div>
                {spamWords.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-amber-600 text-xs">⚠️</span>
                    <div className="flex gap-1">
                      {spamWords.slice(0,2).map(word => (
                        <Badge key={word} variant="secondary" className="text-xs px-1 py-0">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Your photography session is confirmed!"
                  className="flex-1 h-8 text-sm"
                />
                <EmojiPicker onEmojiSelect={insertEmojiInSubject} />
                <VariablePicker 
                  onVariableSelect={insertVariableInSubject}
                  trigger={
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                      {"{…}"}
                    </Button>
                  }
                />
              </div>
            </div>

            {/* Preheader - Compact */}
            <div>
              <Label htmlFor="email-preheader" className="text-xs font-medium text-muted-foreground mb-1 block">
                📄 Preheader
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id="email-preheader"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  placeholder="We're excited to capture your special moments"
                  className="flex-1 h-8 text-sm"
                />
                <VariablePicker 
                  onVariableSelect={insertVariableInPreheader}
                  trigger={
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                      {"{…}"}
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
            preheader={preheader}
            previewData={selectedData.data}
          />
        </div>
      </div>
    </div>
  );
}