import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Plus, Search, Edit, Trash2, Copy, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, tr } from 'date-fns/locale';
import { DeleteTemplateDialog } from "@/components/template-builder/DeleteTemplateDialog";
import { useTemplateOperations } from "@/hooks/useTemplateOperations";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { TemplateErrorBoundary } from "@/components/template-builder/TemplateErrorBoundary";
import { Template } from "@/types/template";
import { useTranslation } from "react-i18next";

// Optimized Templates component with memoization and error handling
const OptimizedTemplatesContent = React.memo(() => {
  const { t, i18n } = useTranslation("pages");
  const navigate = useNavigate();
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
    template: any | null;
  }>({ open: false, template: null });
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTemplate = React.useCallback((template: any) => {
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

  const handleDuplicateTemplate = React.useCallback(async (template: any) => {
    await duplicateTemplate(template);
  }, [duplicateTemplate]);

  // Helper function to extract preview text from template
  const extractPreviewText = React.useCallback((template: Template): string => {
    // First priority: email subject from channel views
    if (template.channels?.email?.subject?.trim()) {
      return template.channels.email.subject.trim();
    }
    
    // Second priority: master subject
    if (template.master_subject?.trim()) {
      return template.master_subject.trim();
    }
    
    // Third priority: email content from channel views
    if (template.channels?.email?.content?.trim()) {
      const plainText = template.channels.email.content.replace(/<[^>]*>/g, '').trim();
      if (plainText) {
        return plainText.length > 60 ? `${plainText.substring(0, 60)}...` : plainText;
      }
    }
    
    // Fallback: master content
    if (template.master_content?.trim()) {
      const plainText = template.master_content.replace(/<[^>]*>/g, '').trim();
      return plainText.length > 60 ? `${plainText.substring(0, 60)}...` : plainText;
    }
    
    return 'No preview available';
  }, []);

  const columns: Column<Template>[] = useMemo(() => [
    {
      key: 'name',
      header: t("templates.table.templateName"),
      sortable: true,
      render: (template) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{template.name}</div>
          {template.master_content && (
            <div className="text-sm text-muted-foreground truncate mt-1">
              {template.master_content.length > 60 ? `${template.master_content.substring(0, 60)}...` : template.master_content}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'preview',
      header: t("templates.table.preview"),
      render: (template) => (
        <div className="max-w-xs min-w-0">
          <div className="text-sm text-muted-foreground line-clamp-2">
            {extractPreviewText(template)}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: t("templates.table.status"),
      sortable: true,
      render: (template) => {
        const isPublished = template.is_active;
        return (
          <Badge variant={isPublished ? 'default' : 'secondary'}>
            {isPublished ? t("templates.status.published") : t("templates.status.draft")}
          </Badge>
        );
      }
    },
    {
      key: 'updated_at',
      header: t("templates.table.lastUpdated"),
      sortable: true,
      render: (template) => (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true, locale: dateLocale })}
        </div>
      )
    },
    {
      key: 'actions',
      header: t("templates.table.actions"),
      render: (template) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/template-builder?id=${template.id}`);
            }}
          >
            <Edit className="h-4 w-4 mr-1" />
            {t("templates.buttons.edit")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicateTemplate(template);
            }}
            title={t("templates.buttons.duplicate")}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTemplate(template);
            }}
            className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
            title={t("templates.buttons.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ], [handleDeleteTemplate, handleDuplicateTemplate, navigate, t]);

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
        subtitle={t("templates.subtitle")}
      />
      
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t("templates.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => navigate('/template-builder')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("templates.buttons.newTemplate")}
          </Button>
        </div>

        {/* Templates Table */}
        <div className="bg-card rounded-lg border">
          {loading ? (
            <div className="p-8">
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : (
            <DataTable
              data={filteredTemplates}
              columns={columns}
              emptyState={emptyState}
              itemsPerPage={15}
            />
          )}
        </div>
      </div>

      {/* Delete Template Dialog */}
      <DeleteTemplateDialog
        open={deleteDialog.open}
        onClose={cancelDeleteTemplate}
        onConfirm={confirmDeleteTemplate}
        templateName={deleteDialog.template?.name || ''}
        loading={deleting}
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