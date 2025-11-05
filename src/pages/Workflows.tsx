import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AdvancedDataTable,
  type AdvancedTableColumn,
  type AdvancedDataTableSortState,
} from "@/components/data-table";
import { PageLoadingSkeleton } from "@/components/ui/loading-presets";
import { useWorkflows } from "@/hooks/useWorkflows";
import { CreateWorkflowSheet } from "@/components/CreateWorkflowSheet";
import { WorkflowDeleteDialog } from "@/components/WorkflowDeleteDialog";
import type { WorkflowWithMetadata } from "@/hooks/useWorkflows";
import { Plus, Zap, CheckCircle, Clock, AlertTriangle, Edit, Trash2, Mail, MessageCircle, Phone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { enUS, tr } from 'date-fns/locale';
import { useTranslation } from "react-i18next";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  KPI_ACTION_BUTTON_CLASS,
  getKpiIconPreset,
} from "@/components/ui/kpi-presets";
import { SegmentedControl } from "@/components/ui/segmented-control";

export default function Workflows() {
  const { t, i18n } = useTranslation("pages");
  const { workflows, loading, createWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflowStatus } = useWorkflows();
  const dateLocale = i18n.language === 'tr' ? tr : enUS;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "name",
    direction: "asc",
  });

  const filteredWorkflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return workflows.filter((workflow) => {
      const matchesSearch =
        query.length === 0 ||
        workflow.name.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && workflow.is_active) ||
        (statusFilter === "paused" && !workflow.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [workflows, searchQuery, statusFilter]);

  const getTriggerLabel = useCallback((triggerType: string) => {
    const triggerKey = `workflows.triggers.${triggerType}` as const;
    return t(triggerKey, { defaultValue: triggerType });
  }, [t]);

  const getChannelIcons = useCallback((channels: string[]) => {
    const iconMap = {
      email: Mail,
      sms: Phone,
      whatsapp: MessageCircle,
    };

    return (
      channels?.map((channel) => {
        const IconComponent = iconMap[channel as keyof typeof iconMap];
        if (!IconComponent) return null;

        return (
          <div key={channel} className="p-1 bg-muted rounded">
            <IconComponent className="h-3 w-3" />
          </div>
        );
      }).filter(Boolean) || []
    );
  }, []);

  const sortedWorkflows = useMemo(() => {
    const data = [...filteredWorkflows];
    const { columnId, direction } = sortState;
    if (!columnId) {
      return data;
    }

    const multiplier = direction === "asc" ? 1 : -1;

    data.sort((a, b) => {
      switch (columnId) {
        case "name":
          return multiplier * a.name.localeCompare(b.name);
        case "trigger_type":
          return multiplier * getTriggerLabel(a.trigger_type).localeCompare(
            getTriggerLabel(b.trigger_type)
          );
        case "status":
          return multiplier * ((a.is_active === b.is_active) ? 0 : a.is_active ? -1 : 1);
        case "created_at":
          return multiplier * (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        default:
          return 0;
      }
    });

    return data;
  }, [filteredWorkflows, getTriggerLabel, sortState]);

  const totalCount = sortedWorkflows.length;

  const paginatedWorkflows = useMemo(
    () => sortedWorkflows.slice(0, page * pageSize),
    [page, pageSize, sortedWorkflows]
  );

  const hasMoreWorkflows = paginatedWorkflows.length < totalCount;
  const handleLoadMoreWorkflows = useCallback(() => {
    if (!hasMoreWorkflows) return;
    setPage((prev) => prev + 1);
  }, [hasMoreWorkflows]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pageSize, totalCount]);

  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowWithMetadata | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowWithMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    const normalized = (value as "all" | "active" | "paused") || "all";
    setStatusFilter(normalized);
    setPage(1);
  }, []);

  const handleEditWorkflow = useCallback((workflow: WorkflowWithMetadata) => {
    setEditingWorkflow(workflow);
  }, []);

  const handleDeleteWorkflow = useCallback((workflow: WorkflowWithMetadata) => {
    setDeletingWorkflow(workflow);
  }, []);

  const confirmDeleteWorkflow = async () => {
    if (!deletingWorkflow) return;
    
    setIsDeleting(true);
    try {
      await deleteWorkflow(deletingWorkflow.id);
      setDeletingWorkflow(null);
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteWorkflow = () => {
    if (!isDeleting) {
      setDeletingWorkflow(null);
    }
  };

  const stats = useMemo(
    () => ({
      total: workflows.length,
      active: workflows.filter((w) => w.is_active).length,
      paused: workflows.filter((w) => !w.is_active).length,
    }),
    [workflows]
  );

  const totalSummary = useMemo(
    () =>
      t("workflows.stats.summary", {
        active: stats.active,
        paused: stats.paused,
      }),
    [stats.active, stats.paused, t]
  );

  const activeCoverage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;
  const pausedShare = stats.total > 0 ? (stats.paused / stats.total) * 100 : 0;
  // Prefab icon style sets for KPI cards (shared across the app)
  const iconIndigo = getKpiIconPreset("indigo");
  const iconSky = getKpiIconPreset("sky");
  const iconEmerald = getKpiIconPreset("emerald");

  const workflowColumns: AdvancedTableColumn<WorkflowWithMetadata>[] = useMemo(
    () => [
      {
        id: "name",
        label: t("workflows.table.workflowName"),
        sortable: true,
        sortId: "name",
        hideable: false,
        minWidth: "200px",
        render: (workflow) => (
          <div>
            <div className="font-medium">{workflow.name}</div>
            {workflow.description && (
              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                {workflow.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "trigger_type",
        label: t("workflows.table.trigger"),
        sortable: true,
        sortId: "trigger_type",
        hideable: true,
        minWidth: "160px",
        render: (workflow) => (
          <div className="text-sm">
            {getTriggerLabel(workflow.trigger_type)}
          </div>
        ),
      },
      {
        id: "channels",
        label: t("workflows.table.channels"),
        sortable: false,
        hideable: true,
        minWidth: "120px",
        render: (workflow) => {
          const channels = workflow.channels ?? [];
          const icons = getChannelIcons(channels);

          return (
            <div className="flex gap-1">
              {icons.length > 0 ? (
                icons
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t("workflows.channels.noChannels")}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        label: t("workflows.table.status"),
        sortable: true,
        sortId: "status",
        hideable: true,
        minWidth: "120px",
        render: (workflow) => (
          <Badge variant={workflow.is_active ? "default" : "secondary"}>
            {workflow.is_active
              ? t("workflows.status.active")
              : t("workflows.status.paused")}
          </Badge>
        ),
      },
      {
        id: "created_at",
        label: t("workflows.table.created"),
        sortable: true,
        sortId: "created_at",
        hideable: true,
        minWidth: "160px",
        render: (workflow) => (
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(workflow.created_at), {
              addSuffix: true,
              locale: dateLocale,
            })}
          </div>
        ),
      },
    ],
    [dateLocale, getChannelIcons, getTriggerLabel, t]
  );

  const headerActions = useMemo(
    () => (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <SegmentedControl
          size="md"
          value={statusFilter}
          onValueChange={(value) => handleStatusFilterChange(value as typeof statusFilter)}
          options={[
            { value: "all", label: t("workflows.tabs.all") },
            { value: "active", label: t("workflows.tabs.active") },
            { value: "paused", label: t("workflows.tabs.paused") },
          ]}
        />
        <CreateWorkflowSheet
          onCreateWorkflow={createWorkflow}
          editWorkflow={editingWorkflow}
          onUpdateWorkflow={updateWorkflow}
          setEditingWorkflow={setEditingWorkflow}
        >
          <Button className="flex items-center gap-2 whitespace-nowrap">
            <Plus className="h-4 w-4" />
            {t("workflows.buttons.createWorkflow")}
          </Button>
        </CreateWorkflowSheet>
      </div>
    ),
    [
      createWorkflow,
      editingWorkflow,
      handleStatusFilterChange,
      statusFilter,
      setEditingWorkflow,
      t,
      updateWorkflow,
    ]
  );

  const renderRowActions = useCallback(
    (workflow: Workflow) => (
      <div className="flex items-center gap-2">
        <Switch
          checked={workflow.is_active}
          onCheckedChange={(checked) => toggleWorkflowStatus(workflow.id, checked)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEditWorkflow(workflow)}
          className="h-8 w-8 p-0"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDeleteWorkflow(workflow)}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
    [handleDeleteWorkflow, handleEditWorkflow, toggleWorkflowStatus]
  );

  const handleTableSortChange = useCallback((next: AdvancedDataTableSortState) => {
    if (!next.columnId) {
      setSortState({ columnId: null, direction: next.direction });
    } else {
      setSortState(next);
    }
    setPage(1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <PageHeader 
          title={t("workflows.title")}
          subtitle={t("workflows.subtitle")}
        />
        <PageLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader 
        title={t("workflows.title")}
        subtitle={t("workflows.subtitle")}
      />
      
      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <KpiCard
            icon={Zap}
            {...iconIndigo}
            title={t("workflows.stats.totalWorkflows")}
            value={stats.total}
            description={totalSummary}
            footer={
              <Button
                size="xs"
                variant="outline"
                className={KPI_ACTION_BUTTON_CLASS}
                onClick={() => handleStatusFilterChange("all")}
              >
                {t("workflows.stats.viewAll")}
              </Button>
            }
          />
          <KpiCard
            icon={CheckCircle}
            {...iconSky}
            title={t("workflows.stats.active")}
            value={stats.active}
            description={t("workflows.stats.activeDescription")}
            progress={{
              value: activeCoverage,
              label: t("workflows.stats.coverageLabel"),
              ariaLabel: t("workflows.stats.coverageAriaLabel"),
              action: (
                <Button
                  size="xs"
                  variant="outline"
                  className={KPI_ACTION_BUTTON_CLASS}
                  onClick={() => handleStatusFilterChange("active")}
                >
                  {t("workflows.stats.quickFilterActive")}
                </Button>
              ),
            }}
          />
          <KpiCard
            icon={Clock}
            {...iconEmerald}
            title={t("workflows.stats.paused")}
            value={stats.paused}
            description={t("workflows.stats.pausedDescription")}
            progress={{
              value: pausedShare,
              label: t("workflows.stats.pausedShareLabel"),
              ariaLabel: t("workflows.stats.pausedShareAriaLabel"),
              action: (
                <Button
                  size="xs"
                  variant="outline"
                  className={KPI_ACTION_BUTTON_CLASS}
                  onClick={() => handleStatusFilterChange("paused")}
                >
                  {t("workflows.stats.quickFilterPaused")}
                </Button>
              ),
            }}
          />
        </div>

        <AdvancedDataTable
          title={t("workflows.table.header", { defaultValue: t("workflows.title") })}
          data={paginatedWorkflows}
          columns={workflowColumns}
          rowKey={(workflow) => workflow.id}
          isLoading={loading}
          zebra
          actions={headerActions}
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder={t("workflows.search")}
          searchLoading={loading}
          searchDelay={0}
          sortState={sortState}
          onSortChange={handleTableSortChange}
          onLoadMore={hasMoreWorkflows ? handleLoadMoreWorkflows : undefined}
          hasMore={hasMoreWorkflows}
          emptyState={
            workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {t("workflows.emptyState.noWorkflowsYet")}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  {t("workflows.emptyState.createFirstMessage")}
                </p>
                <CreateWorkflowSheet
                  onCreateWorkflow={createWorkflow}
                  editWorkflow={editingWorkflow}
                  onUpdateWorkflow={updateWorkflow}
                  setEditingWorkflow={setEditingWorkflow}
                >
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("workflows.buttons.createFirstWorkflow")}
                  </Button>
                </CreateWorkflowSheet>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {t("workflows.emptyState.noMatchingFilters")}
                </h3>
                <p className="text-muted-foreground">
                  {t("workflows.emptyState.adjustFilters")}
                </p>
              </div>
            )
          }
          rowActions={renderRowActions}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <WorkflowDeleteDialog
        open={!!deletingWorkflow}
        workflow={deletingWorkflow}
        onConfirm={confirmDeleteWorkflow}
        onCancel={cancelDeleteWorkflow}
        isDeleting={isDeleting}
      />
    </div>
  );
}
