import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditorWithTest } from '@/components/template-builder/TemplateEditorWithTest';
import { TemplatePreview } from '@/components/template-builder/TemplatePreview';
import { TemplateBlock } from '@/types/templateBuilder';
import { InlineSubjectEditor } from '@/components/template-builder/InlineSubjectEditor';
import { InlinePreheaderEditor } from '@/components/template-builder/InlinePreheaderEditor';
import { useTemplateBuilder } from '@/hooks/useTemplateBuilder';
import { useTemplateVariables } from '@/hooks/useTemplateVariables';
import { getCharacterCount, checkSpamWords, previewDataSets } from '@/lib/templateUtils';
import { NavigationGuardDialog } from '@/components/settings/NavigationGuardDialog';
import { useSettingsNavigation } from '@/hooks/useSettingsNavigation';

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');

  // Backend hooks
  const { template, loading, saving, lastSaved, isDirty, saveTemplate, publishTemplate, updateTemplate, resetDirtyState } = useTemplateBuilder(templateId || undefined);
  const { getVariableValue } = useTemplateVariables();

  // Local state for UI
  const [activeChannel, setActiveChannel] = useState<'email' | 'whatsapp' | 'sms' | 'plain'>('email');
  const [selectedPreviewData, setSelectedPreviewData] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [isEditingPreheader, setIsEditingPreheader] = useState(false);

  // Template data from backend or defaults
  const templateName = template?.name || 'Untitled Template';
  const subject = template?.subject || '';
  const preheader = template?.preheader || '';
  const blocks = template?.blocks || [];
  const isDraft = template?.status === 'draft' || !template;

  // Navigation guard
  const {
    showGuard,
    message: guardMessage,
    handleNavigationAttempt,
    handleDiscardChanges,
    handleStayOnPage,
    handleSaveAndExit
  } = useSettingsNavigation({
    isDirty,
    onDiscard: () => {
      resetDirtyState();
    },
    onSaveAndExit: async () => {
      await handleSaveTemplate();
    },
    message: "You have unsaved changes to this template."
  });

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

  const handleNavigateBack = () => {
    if (isDirty) {
      if (!handleNavigationAttempt('/templates')) {
        return; // Navigation blocked by guard
      }
    }
    navigate('/templates');
  };


  const handlePublishTemplate = async () => {
    await publishTemplate();
  };

  const handleSubjectSave = async (newSubject: string) => {
    updateTemplate({ subject: newSubject });
    setIsEditingSubject(false);
  };

  const handlePreheaderSave = async (newPreheader: string) => {
    updateTemplate({ preheader: newPreheader });
    setIsEditingPreheader(false);
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
              onClick={handleNavigateBack}
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
              {isDirty && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  Unsaved Changes
                </Badge>
              )}
              {lastSaved && !isDirty && (
                <span className="text-xs text-muted-foreground">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
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
            {/* Subject Line - Side by Side */}
            <div className="space-y-1">
              {isEditingSubject ? (
                <InlineSubjectEditor
                  value={subject}
                  onSave={handleSubjectSave}
                  onCancel={() => setIsEditingSubject(false)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground w-16 flex-shrink-0">
                    Subject:
                  </Label>
                  <button
                    onClick={() => setIsEditingSubject(true)}
                    className="flex-1 flex items-center gap-2 text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 cursor-pointer group"
                  >
                    <span className={`text-sm flex-1 ${!subject ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {subject || "Click to add subject"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-100"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </button>
                </div>
              )}
              
              {/* Character count and spam warnings for subject */}
              {!isEditingSubject && subject && (subjectCharCount > 60 || spamWords.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-16">
                  {subjectCharCount > 60 && (
                    <div className="flex items-center gap-1">
                      <span className="text-amber-600">⚠️</span>
                      <span className="text-amber-600">
                        {subjectCharCount}/60 characters (too long)
                      </span>
                    </div>
                  )}
                  {spamWords.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-amber-600">⚠️</span>
                      <span>Spam words:</span>
                      <div className="flex gap-1">
                        {spamWords.slice(0, 2).map(word => (
                          <Badge key={word} variant="secondary" className="text-xs px-1 py-0">
                            {word}
                          </Badge>
                        ))}
                        {spamWords.length > 2 && (
                          <span className="text-amber-600">+{spamWords.length - 2} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preheader - Side by Side */}
            <div>
              {isEditingPreheader ? (
                <InlinePreheaderEditor
                  value={preheader}
                  onSave={handlePreheaderSave}
                  onCancel={() => setIsEditingPreheader(false)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground w-16 flex-shrink-0">
                    Preheader:
                  </Label>
                  <button
                    onClick={() => setIsEditingPreheader(true)}
                    className="flex-1 flex items-center gap-2 text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 cursor-pointer group"
                  >
                    <span className={`text-sm flex-1 ${!preheader ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {preheader || "Click to add preheader"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-100"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Side - Template Editor */}
        <div className="w-1/2 border-r">
          <TemplateEditorWithTest
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

      {/* Navigation Guard Dialog */}
      <NavigationGuardDialog
        open={showGuard}
        onDiscard={handleDiscardChanges}
        onStay={handleStayOnPage}
        onSaveAndExit={handleSaveAndExit}
        message={guardMessage}
      />
    </div>
  );
}