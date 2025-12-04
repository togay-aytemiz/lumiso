import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AdvancedDataTable,
  type AdvancedTableColumn,
} from "@/components/data-table";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { Plus, Edit, Trash2, Copy, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, tr } from 'date-fns/locale';
import { DeleteTemplateDialog } from "@/components/template-builder/DeleteTemplateDialog";
import { useTemplateOperations } from "@/hooks/useTemplateOperations";
import { TemplateErrorBoundary } from "@/components/template-builder/TemplateErrorBoundary";
import { Template } from "@/types/template";
import { useTranslation } from "react-i18next";
import { PageVideoModal } from "@/components/PageVideoModal";
import { usePageVideoPrompt } from "@/hooks/usePageVideoPrompt";
import GlobalSearch from "@/components/GlobalSearch";
import { VariableTokenText } from "@/components/template-builder/VariableTokenText";
import { useTemplateVariables } from "@/hooks/useTemplateVariables";
import { clearTemplateDraftLocalStorage } from "@/hooks/useTemplateBuilder";

const TEMPLATES_VIDEO_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_TEMPLATES_VIDEO_ID) ||
  "PDJvy9OFcVU";

// Optimized Templates component with memoization and error handling
const OptimizedTemplatesContent = React.memo(() => {
  const { t, i18n } = useTranslation("pages");
  const navigate = useNavigate();
  const {
    isOpen: isTemplatesVideoOpen,
    close: closeTemplatesVideo,
    markCompleted: markTemplatesVideoWatched,
    snooze: snoozeTemplatesVideo
  } = usePageVideoPrompt({ pageKey: "templates", snoozeDays: 1 });
  const dateLocale = i18n.language === 'tr' ? tr : enUS;
  const {
    loading,
    error,
    searchTerm,
    setSearchTerm,
    filteredTemplates,
    deleteTemplate,
    duplicateTemplate,
  } = useTemplateOperations();

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    template: Template | null;
  }>({ open: false, template: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const templateVariablesState = useTemplateVariables();
  const variableLabelMap = useMemo(() => {
    const map: Record<string, string> = {};

    // first prefer variable labels coming from Supabase/context
    templateVariablesState.variables.forEach((variable) => {
      if (variable?.key) {
        map[variable.key] = variable.label ?? variable.key.replace(/_/g, " ");
      }
    });

    // ensure all built-in tokens have localized fallback labels
    const translationOverrides: Record<string, string> = {
      lead_name: "leadFullName",
      lead_email: "leadEmail",
      lead_phone: "leadPhone",
      lead_status: "leadStatus",
      lead_due_date: "leadDueDate",
      lead_created_date: "leadCreatedDate",
      lead_updated_date: "leadUpdatedDate",
      session_name: "sessionName",
      session_date: "sessionDate",
      session_time: "sessionTime",
      session_location: "sessionLocation",
      session_notes: "sessionNotes",
      session_status: "sessionStatus",
      session_type: "sessionType",
      session_duration: "sessionDuration",
      session_meeting_url: "sessionMeetingUrl",
      project_name: "projectName",
      project_type: "projectType",
      project_status: "projectStatus",
      project_due_date: "projectDueDate",
      project_package_name: "projectPackageName",
      business_name: "businessName",
      current_date: "currentDate",
      current_time: "currentTime",
    };

    Object.entries(translationOverrides).forEach(([key, translationKey]) => {
      if (!map[key]) {
        map[key] =
          t(`templateBuilder.variables.labels.${translationKey}`, {
            defaultValue: key.replace(/_/g, " "),
          }) ?? key.replace(/_/g, " ");
      }
    });

    return map;
  }, [templateVariablesState.variables, t]);

  const handleDeleteTemplate = React.useCallback((template: Template) => {
    setDeleteDialog({ open: true, template });
  }, []);

  const confirmDeleteTemplate = React.useCallback(async () => {
    if (!deleteDialog.template) return;

    const { id: templateId, name: templateName } = deleteDialog.template;
    
    try {
      setDeleting(true);
      const success = await deleteTemplate(templateId);
      
      if (success) {
        setDeleteDialog({ open: false, template: null });
      }
    } finally {
      setDeleting(false);
    }
  }, [deleteDialog.template, deleteTemplate]);

  const cancelDeleteTemplate = React.useCallback(() => {
    setDeleteDialog({ open: false, template: null });
  }, []);

  const handleDuplicateTemplate = React.useCallback(async (template: Template) => {
    await duplicateTemplate(template);
  }, [duplicateTemplate]);

  // Helper function to extract preview text from template
  const stripHtml = (value?: string) =>
    value?.replace(/<[^>]*>/g, "").trim() ?? "";

  const extractPreviewText = React.useCallback((template: Template): string => {
    // First priority: email content/body from channel views
    if (template.channels?.email?.content?.trim()) {
      const plainText = stripHtml(template.channels.email.content);
      if (plainText) {
        return plainText;
      }
    }

    // Second priority: master content
    if (template.master_content?.trim()) {
      const plainText = stripHtml(template.master_content);
      if (plainText) {
        return plainText;
      }
    }

    // Fallbacks: subject lines
    if (template.channels?.email?.subject?.trim()) {
      return template.channels.email.subject.trim();
    }
    
    if (template.master_subject?.trim()) {
      return template.master_subject.trim();
    }
    
    return t("templates.preview.noPreview", { defaultValue: "No preview available" });
  }, [t]);

  const columns = useMemo<AdvancedTableColumn<Template>[]>(
    () => [
      {
        id: "name",
        label: t("templates.table.templateName"),
        sortable: true,
        hideable: false,
        minWidth: "200px",
        render: (template) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{template.name}</div>
          </div>
        ),
      },
      {
        id: "preview",
        label: t("templates.table.preview"),
        sortable: false,
        hideable: true,
        minWidth: "240px",
        render: (template) => (
          <div className="max-w-xs min-w-0 text-sm text-muted-foreground line-clamp-2">
            <VariableTokenText
              text={
                template.channels?.email?.subject?.trim()
                  ? template.channels.email.subject.trim()
                  : extractPreviewText(template)
              }
              variableLabels={variableLabelMap}
            />
          </div>
        ),
      },
      {
        id: "status",
        label: t("templates.table.status"),
        sortable: true,
        hideable: true,
        minWidth: "120px",
        render: (template) => {
          const status = template.status ?? (template.is_active ? "published" : "draft");
          return (
            <Badge variant={status === "published" ? "default" : "secondary"}>
              {status === "published"
                ? t("templates.status.published")
                : t("templates.status.draft")}
            </Badge>
          );
        },
      },
      {
        id: "updated_at",
        label: t("templates.table.lastUpdated"),
        sortable: true,
        hideable: true,
        minWidth: "160px",
        render: (template) => (
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(template.updated_at), {
              addSuffix: true,
              locale: dateLocale,
            })}
          </div>
        ),
      },
    ],
    [dateLocale, extractPreviewText, t, variableLabelMap]
  );

  const emptyState = useMemo(() => (
    <div className="text-center py-12">
      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">
        {searchTerm ? t("templates.emptyState.noTemplatesFound") : t("templates.emptyState.noTemplatesYet")}
      </h3>
      <p className="text-muted-foreground mb-6">
        {searchTerm 
          ? t("templates.emptyState.adjustSearch")
          : t("templates.emptyState.createFirstMessage")
        }
      </p>
      {!searchTerm && (
        <Button onClick={() => navigate('/template-builder')}>
          <Plus className="h-4 w-4 mr-2" />
          {t("templates.buttons.createFirstTemplate")}
        </Button>
      )}
    </div>
  ), [searchTerm, navigate, t]);

  const totalCount = filteredTemplates.length;

  const paginatedTemplates = useMemo(
    () => filteredTemplates.slice(0, page * pageSize),
    [filteredTemplates, page, pageSize]
  );

  const hasMoreTemplates = paginatedTemplates.length < totalCount;
  const handleLoadMoreTemplates = useCallback(() => {
    if (!hasMoreTemplates) return;
    setPage((prev) => prev + 1);
  }, [hasMoreTemplates]);

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  React.useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pageSize, totalCount]);

  const headerActions = useMemo(
    () => (
      <Button
        onClick={() => {
          clearTemplateDraftLocalStorage();
          navigate('/template-builder');
        }}
        variant="surface"
        size="sm"
        className="btn-surface-accent flex items-center gap-2 whitespace-nowrap"
      >
        <Plus className="h-4 w-4" />
        {t("templates.buttons.newTemplate")}
      </Button>
    ),
    [navigate, t]
  );

  const handleRowClick = useCallback(
    (template: Template) => {
      navigate(`/template-builder?id=${template.id}`);
    },
    [navigate]
  );

  const renderRowActions = useCallback(
    (template: Template) => (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/template-builder?id=${template.id}`);
          }}
        >
          <Edit className="h-4 w-4 mr-1" />
          {t("templates.buttons.edit")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            handleDuplicateTemplate(template);
          }}
          title={t("templates.buttons.duplicate")}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            handleDeleteTemplate(template);
          }}
          className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
          title={t("templates.buttons.delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
    [handleDeleteTemplate, handleDuplicateTemplate, navigate, t]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-destructive mb-2">{t("templates.error.loadingTemplates")}</div>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title={t("templates.title")}
        helpTitle={t("templates.video.title", { defaultValue: "2 dakikalık hızlı tur" })}
        helpDescription={t("templates.video.description", {
          defaultValue: "Şablonları hızlıca tasarlayıp kullanmayı öğrenin."
        })}
        helpVideoId={TEMPLATES_VIDEO_ID}
        helpVideoTitle={t("templates.video.title", { defaultValue: "See how Templates works" })}
      >
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        <AdvancedDataTable
          title={t("templates.table.title", { defaultValue: t("templates.title") })}
          data={paginatedTemplates}
          columns={columns}
          rowKey={(template) => template.id}
          isLoading={loading}
          loadingState={<TableLoadingSkeleton />}
          actions={headerActions}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("templates.search")}
          searchLoading={loading}
          searchDelay={0}
          emptyState={emptyState}
          onRowClick={handleRowClick}
          rowActions={renderRowActions}
          onLoadMore={hasMoreTemplates ? handleLoadMoreTemplates : undefined}
          hasMore={hasMoreTemplates}
        />
      </div>

      {/* Delete Template Dialog */}
      <DeleteTemplateDialog
        open={deleteDialog.open}
        onClose={cancelDeleteTemplate}
        onConfirm={confirmDeleteTemplate}
        templateName={deleteDialog.template?.name || ''}
        loading={deleting}
      />

      <PageVideoModal
        open={isTemplatesVideoOpen}
        onClose={closeTemplatesVideo}
        videoId={TEMPLATES_VIDEO_ID}
        title={t("templates.video.title", { defaultValue: "See how Templates works" })}
        description={t("templates.video.description", {
          defaultValue: "Watch a quick overview to design and reuse your messages."
        })}
        labels={{
          remindMeLater: t("templates.video.remindLater", { defaultValue: "Remind me later" }),
          dontShowAgain: t("templates.video.dontShow", { defaultValue: "I watched, don't show again" })
        }}
        onSnooze={snoozeTemplatesVideo}
        onDontShowAgain={markTemplatesVideoWatched}
      />
    </div>
  );
});

OptimizedTemplatesContent.displayName = 'OptimizedTemplatesContent';

export default function Templates() {
  return (
    <TemplateErrorBoundary>
      <OptimizedTemplatesContent />
    </TemplateErrorBoundary>
  );
}
