import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Edit, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { OptimizedTemplateEditor } from '@/components/template-builder/OptimizedTemplateEditor';
import { OptimizedTemplatePreview } from '@/components/template-builder/OptimizedTemplatePreview';
import { TemplateBlock } from '@/types/templateBuilder';
import { InlineSubjectEditor } from '@/components/template-builder/InlineSubjectEditor';
import { InlinePreheaderEditor } from '@/components/template-builder/InlinePreheaderEditor';
import { useTemplateBuilder } from '@/hooks/useTemplateBuilder';
import { useTemplateVariables } from '@/hooks/useTemplateVariables';
import { getCharacterCount, checkSpamWords, getPreviewDataSets } from '@/lib/templateUtils';
import { NavigationGuardDialog } from '@/components/settings/NavigationGuardDialog';
import { useSettingsNavigation } from '@/hooks/useSettingsNavigation';
import { TemplateNameDialog } from '@/components/template-builder/TemplateNameDialog';
import { supabase } from '@/integrations/supabase/client';
import { TemplateErrorBoundary } from "@/components/template-builder/TemplateErrorBoundary";
import { useTranslation } from "react-i18next";
import { TemplateVariablesProvider } from "@/contexts/TemplateVariablesContext";
import { VariableTokenText } from "@/components/template-builder/VariableTokenText";
import { Tooltip, TooltipContent, TooltipContentDark, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Optimized TemplateBuilder component
const OptimizedTemplateBuilderContent = React.memo(() => {
  const { t, i18n } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('id');
  const untitledName = useMemo(
    () => t("templateBuilder.untitledTemplate", { defaultValue: "Untitled Template" }),
    [t]
  );

  // Backend hooks
  const {
    template,
    loading,
    saving,
    lastSaved,
    isDirty,
    dirtyVersion,
    saveTemplate,
    publishTemplate,
    updateTemplate,
    resetDirtyState
  } = useTemplateBuilder(templateId || undefined);
  const templateVariablesState = useTemplateVariables();
  const { getVariableValue, variables: templateVariables } = templateVariablesState;

  // Local state for UI
  const [activeChannel, setActiveChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [selectedPreviewData, setSelectedPreviewData] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [isEditingPreheader, setIsEditingPreheader] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'save' | 'publish' | null>(null);
  const [existingTemplateNames, setExistingTemplateNames] = useState<string[]>([]);
  const subjectPlaceholder = useMemo(
    () => t("templateBuilder.preview.defaultSubject", { defaultValue: "Your photography session is confirmed" }),
    [t]
  );
  const preheaderPlaceholder = useMemo(
    () => t("templateBuilder.preview.excitedMessage", { defaultValue: "We're excited to capture your special moments" }),
    [t]
  );
  const [publishTooltipOpen, setPublishTooltipOpen] = useState(false);

  // Template data from backend or defaults
  const templateName = template?.name || untitledName;
  const subject = template?.subject || '';
  const preheader = template?.preheader || '';
  const blocks = useMemo(() => template?.blocks ?? [], [template?.blocks]);
  const isDraft = template?.status === 'draft' || !template;
  const dirtyVersionRef = useRef(dirtyVersion);
  const lastAutoSavedVersionRef = useRef(0);
  const savingRef = useRef(saving);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTemplateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    dirtyVersionRef.current = dirtyVersion;
  }, [dirtyVersion]);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);
  useEffect(() => {
    const currentTemplateKey = template?.id || templateId || null;
    if (lastTemplateKeyRef.current !== currentTemplateKey) {
      lastTemplateKeyRef.current = currentTemplateKey;
      lastAutoSavedVersionRef.current = 0;
    }
  }, [template?.id, templateId]);
  useEffect(() => {
    if (!isDirty && dirtyVersion === 0) {
      lastAutoSavedVersionRef.current = 0;
    }
  }, [isDirty, dirtyVersion]);
  useEffect(() => {
    if (
      isDirty &&
      lastAutoSavedVersionRef.current > 0 &&
      dirtyVersion <= lastAutoSavedVersionRef.current
    ) {
      // Guard against stale dirty flag when a save already caught up
      resetDirtyState();
    }
  }, [isDirty, dirtyVersion, resetDirtyState]);

  // Fetch existing template names for validation
  useEffect(() => {
    const fetchTemplateNames = async () => {
      try {
        const { data, error } = await supabase
          .from('message_templates')
          .select('name')
          .neq('id', templateId || '');
        
        if (error) {
          console.error('Error fetching template names:', error);
          return;
        }

        setExistingTemplateNames(data?.map(t => t.name) || []);
      } catch (error) {
        console.error('Error fetching template names:', error);
      }
    };

    fetchTemplateNames();
  }, [templateId]);

  const untitledAliases = useMemo(
    () =>
      [
        untitledName,
        tCommon("templateBuilder.untitledTemplate", { defaultValue: "" }),
        "untitled template",
        "new template",
        "template"
      ]
        .filter(Boolean)
        .map((entry) => entry.toLowerCase().trim()),
    [tCommon, untitledName]
  );

  // Helper function to check if template name is untitled
  const isUntitledTemplate = useCallback((name: string) => {
    const normalizedName = name.toLowerCase().trim();
    return (
      normalizedName === "" ||
      normalizedName.includes("untitled") ||
      untitledAliases.includes(normalizedName)
    );
  }, [untitledAliases]);

  // Navigation guard
  const {
    showGuard,
    message: guardMessage,
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
    message: t("templateBuilder.navigationGuard.unsavedChanges")
  });

  const handleSaveTemplate = useCallback(async (customName?: string) => {
    const nameToUse = customName || templateName;
    
    // Check if template needs a name
    if (isUntitledTemplate(nameToUse)) {
      setPendingAction('save');
      setShowNameDialog(true);
      return;
    }

    if (!template) {
      // Create new template
      const newTemplate = await saveTemplate({
        name: nameToUse,
        subject,
        preheader,
        blocks,
        status: 'draft',
        category: 'general',
      });
      
      if (newTemplate) {
        lastAutoSavedVersionRef.current = dirtyVersionRef.current;
        // Update URL to include template ID
        navigate(`/template-builder?id=${newTemplate.id}`, { replace: true });
      }
    } else {
      // Update existing template
      const saved = await saveTemplate({
        ...template,
        name: nameToUse,
        subject,
        preheader,
        blocks,
      });

      if (saved) {
        lastAutoSavedVersionRef.current = dirtyVersionRef.current;
      }
    }
  }, [template, saveTemplate, templateName, subject, preheader, blocks, navigate]);

  const handleAutoSave = useCallback(async () => {
    if (savingRef.current) return;

    const versionToSave = dirtyVersionRef.current;
    if (versionToSave <= lastAutoSavedVersionRef.current) return;

    const saved = await saveTemplate(
      {
        name: templateName,
        subject,
        preheader,
        blocks,
        status: isDraft ? 'draft' : 'published',
        category: template?.category || 'general',
      },
      false
    );

    if (saved) {
      lastAutoSavedVersionRef.current = versionToSave;
    }
  }, [
    saveTemplate,
    templateName,
    subject,
    preheader,
    blocks,
    isDraft,
    template?.category,
    templateId,
    navigate,
  ]);

  useEffect(() => {
    const debounceDelay = 3000;

    if (saving) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    if (!isDirty || dirtyVersion <= lastAutoSavedVersionRef.current) {
      return;
    }

    // Fallback tiny debounce in case multiple updates fire synchronously
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      if (savingRef.current) return;
      if (dirtyVersionRef.current <= lastAutoSavedVersionRef.current) return;
      void handleAutoSave();
    }, debounceDelay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [dirtyVersion, isDirty, saving, handleAutoSave]);

  const handleNavigateBack = useCallback(async () => {
    if (isDirty && dirtyVersion > lastAutoSavedVersionRef.current) {
      await handleAutoSave();
    }
    navigate('/templates');
  }, [isDirty, dirtyVersion, handleAutoSave, navigate]);

  const handlePublishTemplate = useCallback(async (customName?: string) => {
    const nameToUse = customName || templateName;
    
    // Check if template needs a name
    if (isUntitledTemplate(nameToUse)) {
      setPendingAction('publish');
      setShowNameDialog(true);
      return;
    }

    // Directly publish with all current data (atomic operation)
    const publishedTemplate = await publishTemplate({
      name: nameToUse,
      subject,
      preheader,
      blocks,
      category: template?.category || 'general',
    });

    // Update URL if it's a new template
    if (publishedTemplate) {
      lastAutoSavedVersionRef.current = dirtyVersionRef.current;
      if (!templateId) {
        navigate(`/template-builder?id=${publishedTemplate.id}`, { replace: true });
      }
    }
  }, [templateName, subject, preheader, blocks, template?.category, publishTemplate, templateId, navigate]);

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


  const handleBlocksChange = useCallback((newBlocks: TemplateBlock[]) => {
    updateTemplate({ blocks: newBlocks });
  }, [updateTemplate]);

  // Handle name dialog confirmation
  const handleNameDialogConfirm = async (name: string) => {
    setShowNameDialog(false);
    
    // Update the template name in local state first
    updateTemplate({ name });
    
    // Perform the pending action with the new name
    if (pendingAction === 'save') {
      await handleSaveTemplate(name);
    } else if (pendingAction === 'publish') {
      await handlePublishTemplate(name);
    }
    
    setPendingAction(null);
  };

  // Handle name dialog cancel
  const handleNameDialogCancel = () => {
    setShowNameDialog(false);
    setPendingAction(null);
  };

  // Memoize expensive calculations
  const subjectCharCount = useMemo(() => getCharacterCount(subject), [subject]);
  const spamWords = useMemo(() => checkSpamWords(subject), [subject]);
  const previewDataSets = useMemo(() => getPreviewDataSets(i18n.language), [i18n.language]);
  useEffect(() => {
    if (selectedPreviewData >= previewDataSets.length) {
      setSelectedPreviewData(0);
    }
  }, [selectedPreviewData, previewDataSets]);
  const selectedPreviewDataset = useMemo(() => {
    if (previewDataSets.length === 0) {
      return undefined;
    }
    const safeIndex = Math.min(selectedPreviewData, previewDataSets.length - 1);
    return previewDataSets[safeIndex];
  }, [previewDataSets, selectedPreviewData]);
  const datasetWithAliases = useMemo(() => {
    const base = selectedPreviewDataset?.data ?? {};
    const enhanced: Record<string, string> = { ...base };
    if (enhanced.customer_name && !enhanced.lead_name) {
      enhanced.lead_name = enhanced.customer_name;
    }
    if (enhanced.customer_email && !enhanced.lead_email) {
      enhanced.lead_email = enhanced.customer_email;
    }
    if (enhanced.customer_phone && !enhanced.lead_phone) {
      enhanced.lead_phone = enhanced.customer_phone;
    }
    return enhanced;
  }, [selectedPreviewDataset]);
  const variableFallbacks = useMemo(() => {
    const map: Record<string, string> = {};
    templateVariables.forEach((variable) => {
      map[variable.key] = getVariableValue(variable.key);
    });
    return map;
  }, [getVariableValue, templateVariables]);
  const previewMockData = useMemo(() => ({
    ...variableFallbacks,
    ...datasetWithAliases
  }), [variableFallbacks, datasetWithAliases]);
  const variableLabels = useMemo(() => {
    const map: Record<string, string> = {};
    templateVariables.forEach((variable) => {
      if (variable?.key) {
        map[variable.key] = variable.label ?? variable.key;
      }
    });
    return map;
  }, [templateVariables]);
  const hasSavedVersion = useMemo(
    () => Boolean((template?.id || '').trim()) || Boolean(lastSaved),
    [template?.id, lastSaved]
  );
  const hasUnsavedChanges = isDirty;
  const statusLabel = useMemo(() => {
    if (saving) {
      return t("templateBuilder.status.saving", { defaultValue: "Saving..." });
    }
    if (hasUnsavedChanges) {
      return t("templateBuilder.status.unsavedChanges", { defaultValue: "Unsaved changes" });
    }
    if (!hasSavedVersion) {
      return t("templateBuilder.status.notSavedYet", { defaultValue: "Not saved yet" });
    }
    return t("templateBuilder.status.allChangesSaved", { defaultValue: "All changes saved" });
  }, [saving, hasUnsavedChanges, hasSavedVersion, t]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">{t("templateBuilder.loading")}</div>
        </div>
      </div>
    );
  }

  const backLabel = tCommon("buttons.back", { defaultValue: "Back" });
  const publishDisabled = saving || (!template?.id && !templateId && !isDirty);
  const publishTooltip = saving
    ? t("templateBuilder.status.saving", { defaultValue: "Saving..." })
    : t("templateBuilder.status.publishDisabledTooltip", {
        defaultValue: "Start editing to enable Publish"
      });

  return (
    <TemplateVariablesProvider value={templateVariablesState}>
      <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="tinted"
              colorScheme="slate"
              size="icon"
              onClick={handleNavigateBack}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
              <span className="sr-only">{backLabel}</span>
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
                  <Badge variant={isDraft ? "secondary" : "default"}>
                    {isDraft ? t("templateBuilder.badges.draft") : t("templateBuilder.badges.published")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {statusLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {publishDisabled ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip
                  open={publishTooltipOpen}
                  onOpenChange={setPublishTooltipOpen}
                  disableHoverableContent
                >
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={() => (isDraft ? handlePublishTemplate() : handleNavigateBack())}
                        disabled
                        variant="surface"
                        size="sm"
                        className="btn-surface-accent"
                      >
                        <Eye className="h-4 w-4" />
                        {isDraft ? t("templateBuilder.buttons.publish") : t("templateBuilder.buttons.done", { defaultValue: "Done" })}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContentDark side="bottom" align="center">
                    <span className="max-w-[240px] text-sm text-slate-50">
                      {publishTooltip}
                    </span>
                  </TooltipContentDark>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                onClick={() => (isDraft ? handlePublishTemplate() : handleNavigateBack())}
                disabled={publishDisabled}
                variant="surface"
                size="sm"
                className="btn-surface-accent"
              >
                <Eye className="h-4 w-4" />
                {isDraft ? t("templateBuilder.buttons.publish") : t("templateBuilder.buttons.done", { defaultValue: "Done" })}
              </Button>
            )}
          </div>
        </div>

        {/* Compact Email Settings */}
        {activeChannel === "email" && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Subject Line - Side by Side */}
            <div className="space-y-1">
              <div className="flex items-center gap-3 pl-1">
                <Label className="text-sm text-muted-foreground w-20 flex-shrink-0">
                  {t("templateBuilder.email.subject")}
                </Label>
                <div className="flex-1 min-w-0">
                  {isEditingSubject ? (
                    <InlineSubjectEditor
                      value={subject}
                      onSave={handleSubjectSave}
                      onCancel={() => setIsEditingSubject(false)}
                      placeholder={subjectPlaceholder}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingSubject(true)}
                      className="flex h-auto w-full flex-1 items-center justify-between gap-2 text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 group"
                    >
                      <span className={`text-sm flex-1 ${!subject ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {subject ? (
                          <VariableTokenText
                            text={subject}
                            placeholder={t("templateBuilder.email.addSubject")}
                            variableLabels={variableLabels}
                          />
                        ) : (
                          t("templateBuilder.email.addSubject")
                        )}
                      </span>
                      <Edit className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Character count and spam warnings for subject */}
              {!isEditingSubject && subject && (subjectCharCount > 60 || spamWords.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-24">
                  {subjectCharCount > 60 && (
                    <div className="flex items-center gap-1">
                      <span className="text-amber-600">⚠️</span>
                      <span className="text-amber-600">
                        {t("templateBuilder.warnings.tooLong", { count: subjectCharCount })}
                      </span>
                    </div>
                  )}
                  {spamWords.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-amber-600">⚠️</span>
                      <span>{t("templateBuilder.warnings.spamWords")}</span>
                      <div className="flex gap-1">
                        {spamWords.slice(0, 2).map(word => (
                          <Badge key={word} variant="secondary" className="text-xs px-1 py-0">
                            {word}
                          </Badge>
                        ))}
                        {spamWords.length > 2 && (
                          <span className="text-amber-600">
                            {t("templateBuilder.warnings.moreSpamWords", { count: spamWords.length - 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preheader - Side by Side */}
            <div>
              <div className="flex items-center gap-3 pl-1">
                <Label className="text-sm text-muted-foreground w-20 flex-shrink-0">
                  {t("templateBuilder.email.preheader")}
                </Label>
                <div className="flex-1 min-w-0">
                  {isEditingPreheader ? (
                    <InlinePreheaderEditor
                      value={preheader}
                      onSave={handlePreheaderSave}
                      onCancel={() => setIsEditingPreheader(false)}
                      placeholder={preheaderPlaceholder}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingPreheader(true)}
                      className="flex h-auto w-full flex-1 items-center justify-between gap-2 text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 group"
                    >
                      <span className={`text-sm flex-1 ${!preheader ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {preheader ? (
                          <VariableTokenText
                            text={preheader}
                            placeholder={t("templateBuilder.email.addPreheader")}
                            variableLabels={variableLabels}
                          />
                        ) : (
                          t("templateBuilder.email.addPreheader")
                        )}
                      </span>
                      <Edit className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Side - Template Editor */}
        <div className="w-1/2 border-r">
          <OptimizedTemplateEditor
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
          />
        </div>

        {/* Right Side - Live Preview */}
        <div className="w-1/2">
          <OptimizedTemplatePreview
            blocks={blocks}
            activeChannel={activeChannel}
            onChannelChange={(channel) => setActiveChannel(channel)}
            emailSubject={subject}
            preheader={preheader}
            previewData={previewMockData}
            showSendTestButton={false}
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

      {/* Template Name Dialog */}
      <TemplateNameDialog
        open={showNameDialog}
        onClose={handleNameDialogCancel}
        onConfirm={handleNameDialogConfirm}
        currentName={templateName}
        existingNames={existingTemplateNames}
        action={pendingAction || 'save'}
        loading={saving}
      />
    </div>
  </TemplateVariablesProvider>
  );
});

OptimizedTemplateBuilderContent.displayName = 'OptimizedTemplateBuilderContent';

export default function TemplateBuilder() {
  const { t } = useTranslation("pages");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
    checkIsMobile();

    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  if (isMobile) {
    return (
      <TemplateErrorBoundary>
        <div className="flex min-h-[70vh] items-center justify-center px-6 py-10">
          <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MonitorSmartphone className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">
              {t("templateBuilder.mobileNotSupported.title", {
                defaultValue: "Masaüstünde devam edin",
              })}
            </h2>
            <p className="text-sm text-slate-600">
              {t("templateBuilder.mobileNotSupported.description", {
                defaultValue:
                  "Şablon oluşturucu şu an mobilde desteklenmiyor. Masaüstünden açarak düzenlemeye devam edebilirsiniz.",
              })}
            </p>
          </div>
        </div>
      </TemplateErrorBoundary>
    );
  }

  return (
    <TemplateErrorBoundary>
      <OptimizedTemplateBuilderContent />
    </TemplateErrorBoundary>
  );
}
