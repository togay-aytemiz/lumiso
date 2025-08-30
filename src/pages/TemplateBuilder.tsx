import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, Eye, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditor } from '@/components/template-builder/TemplateEditor';
import { TemplatePreview } from '@/components/template-builder/TemplatePreview';
import { TemplateBlock } from '@/types/templateBuilder';
import { EmojiPicker } from '@/components/template-builder/EmojiPicker';
import { VariablePicker } from '@/components/template-builder/VariablePicker';
import { useTemplateBuilder } from '@/hooks/useTemplateBuilder';
import { useTemplateVariables } from '@/hooks/useTemplateVariables';
import { getCharacterCount, checkSpamWords, previewDataSets } from '@/lib/templateUtils';

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');

  // Backend hooks
  const { template, loading, saving, lastSaved, saveTemplate, publishTemplate, updateTemplate } = useTemplateBuilder(templateId || undefined);
  const { getVariableValue } = useTemplateVariables();

  // Local state for UI
  const [activeChannel, setActiveChannel] = useState<'email' | 'whatsapp' | 'sms' | 'plain'>('email');
  const [selectedPreviewData, setSelectedPreviewData] = useState(0);
  const [subjectEmojiOpen, setSubjectEmojiOpen] = useState(false);
  const [preheaderEmojiOpen, setPreheaderEmojiOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  // Template data from backend or defaults
  const templateName = template?.name || 'Untitled Template';
  const subject = template?.subject || '';
  const preheader = template?.preheader || '';
  const blocks = template?.blocks || [];
  const isDraft = template?.status === 'draft' || !template;

  const handleSaveTemplate = async () => {
    if (!template) {
      // Create new template
      const newTemplate = await saveTemplate({
        name: templateName,
        subject,
        preheader,
        blocks,
        status: 'draft',
        category: 'general',
      });
      
      if (newTemplate) {
        // Update URL to include template ID
        navigate(`/template-builder?id=${newTemplate.id}`, { replace: true });
      }
    } else {
      // Update existing template
      await saveTemplate({
        ...template,
        name: templateName,
        subject,
        preheader,
        blocks,
      });
    }
  };

  const handleTestSend = () => {
    // TODO: Implement test email sending
    toast({
      title: "Test email sent",
      description: "A test email has been sent to your email address.",
    });
  };

  const handlePublishTemplate = async () => {
    await publishTemplate();
  };

  const insertVariableInSubject = (variable: string) => {
    updateTemplate({ subject: (subject + variable) });
  };

  const insertVariableInPreheader = (variable: string) => {
    updateTemplate({ preheader: (preheader + variable) });
  };

  const insertEmojiInSubject = (emoji: string) => {
    updateTemplate({ subject: (subject + emoji) });
    setSubjectEmojiOpen(false);
  };

  const handleNameEdit = () => {
    setEditingName(templateName);
    setIsEditingName(true);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editingName !== templateName) {
      updateTemplate({ name: editingName });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    }
  };

  const handleSubjectChange = (newSubject: string) => {
    updateTemplate({ subject: newSubject });
  };

  const handlePreheaderChange = (newPreheader: string) => {
    updateTemplate({ preheader: newPreheader });
  };

  const handleBlocksChange = (newBlocks: TemplateBlock[]) => {
    updateTemplate({ blocks: newBlocks });
  };

  const subjectCharCount = getCharacterCount(subject);
  const spamWords = checkSpamWords(subject);
  const selectedData = previewDataSets[selectedPreviewData];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading template...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/automation-templates')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
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
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={isDraft ? "secondary" : "default"}>
                {isDraft ? "Draft" : "Published"}
              </Badge>
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
            <Button variant="outline" onClick={handleSaveTemplate} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button onClick={handlePublishTemplate} disabled={saving}>
              <Eye className="h-4 w-4" />
              {isDraft ? "Publish" : "Published"}
            </Button>
          </div>
        </div>

        {/* Compact Email Settings */}
        {activeChannel === "email" && (
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
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
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
                  onChange={(e) => handlePreheaderChange(e.target.value)}
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
            onBlocksChange={handleBlocksChange}
          />
        </div>

        {/* Right Side - Live Preview */}
        <div className="w-1/2">
          <TemplatePreview
            blocks={blocks}
            activeChannel={activeChannel as 'email' | 'whatsapp' | 'sms' | 'plaintext'}
            onChannelChange={(channel) => setActiveChannel(channel as 'email' | 'whatsapp' | 'sms' | 'plain')}
            emailSubject={subject}
            preheader={preheader}
            previewData={selectedData.data}
          />
        </div>
      </div>
    </div>
  );
}