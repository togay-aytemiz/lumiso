import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings2, RotateCcw, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface ColumnPreference {
  id: string;
  visible: boolean;
  order: number;
}

export interface ColumnSettingsMeta {
  id: string;
  label: string;
  description?: string;
  hideable?: boolean;
}

interface ColumnSettingsButtonProps {
  preferences: ColumnPreference[];
  columns: ColumnSettingsMeta[];
  defaultPreferences: ColumnPreference[];
  onChange: (next: ColumnPreference[]) => void;
  className?: string;
  disabled?: boolean;
}

export function ColumnSettingsButton({
  preferences,
  columns,
  defaultPreferences,
  onChange,
  className,
  disabled,
}: ColumnSettingsButtonProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<ColumnPreference[]>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const orderedColumns = useMemo(() => {
    const preferenceMap = new Map(localPrefs.map((pref) => [pref.id, pref]));
    return columns
      .map((col, index) => {
        const pref = preferenceMap.get(col.id);
        return {
          ...col,
          visible:
            pref?.visible ??
            defaultPreferences.find((p) => p.id === col.id)?.visible ??
            true,
          order:
            pref?.order ??
            defaultPreferences.find((p) => p.id === col.id)?.order ??
            index,
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [columns, localPrefs, defaultPreferences]);

  const visibleCount = orderedColumns.filter(
    (col) => col.visible || col.hideable === false
  ).length;

  const minimumVisible =
    orderedColumns.filter((col) => col.hideable !== false).length > 0
      ? 1
      : 0;

  const updatePreferences = (next: ColumnPreference[]) => {
    const normalized = next
      .map((pref, index) => ({ ...pref, order: index }))
      .filter((pref) => columns.some((col) => col.id === pref.id));
    setLocalPrefs(normalized);
  };

  const handleToggle = (columnId: string) => {
    const columnMeta = columns.find((col) => col.id === columnId);
    if (!columnMeta) return;
    if (columnMeta.hideable === false) return;

    const currentlyVisible = orderedColumns.find(
      (col) => col.id === columnId
    )?.visible;

    if (currentlyVisible && visibleCount <= minimumVisible) {
      return;
    }

    const nextPrefs = orderedColumns.map((col) => ({
      id: col.id,
      visible:
        col.id === columnId ? !col.visible : col.visible || col.hideable === false,
      order: col.order,
    }));
    updatePreferences(nextPrefs);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(orderedColumns);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    const nextPrefs = items.map((item, index) => ({
      id: item.id,
      visible: item.visible,
      order: index,
    }));
    updatePreferences(nextPrefs);
  };

  const handleSave = () => {
    setSaving(true);
    onChange(localPrefs);
    setSaving(false);
    setOpen(false);
  };

  const handleReset = () => {
    updatePreferences(defaultPreferences);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("flex items-center gap-2", className)}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Settings2 className="h-4 w-4" />
        <span className="hidden sm:inline">
          {t("buttons.customize_columns")}
        </span>
        <span className="sm:hidden">{t("buttons.columns")}</span>
        <Badge variant="secondary" className="ml-1">
          {visibleCount}
        </Badge>
      </Button>

      <AppSheetModal
        isOpen={open}
        onOpenChange={setOpen}
        title={t("table.customizeTableColumns")}
        footerActions={[
          {
            label: t("buttons.cancel"),
            variant: "outline" as const,
            onClick: () => setOpen(false),
            disabled: saving,
          },
          {
            label: saving ? t("actions.saving") : t("buttons.save_changes"),
            onClick: handleSave,
            disabled: saving,
            loading: saving,
          },
        ]}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("table.chooseColumnsDescription")}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("labels.visible_columns", {
                visible: visibleCount,
                total: columns.length,
              })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t("buttons.reset")}
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {orderedColumns.map((column, index) => {
                    const isVisible =
                      column.visible || column.hideable === false;
                    return (
                      <Draggable
                        key={column.id}
                        draggableId={column.id}
                        index={index}
                      >
                        {(draggableProvided, snapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            className={cn(
                              "flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2",
                              snapshot.isDragging && "bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  !isVisible &&
                                    column.hideable !== false &&
                                    "text-muted-foreground"
                                )}
                              >
                                {column.label}
                              </span>
                              {column.description && (
                                <span className="text-xs text-muted-foreground">
                                  {column.description}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={isVisible}
                                onCheckedChange={() => handleToggle(column.id)}
                                disabled={column.hideable === false}
                              />
                              <div
                                {...draggableProvided.dragHandleProps}
                                className="cursor-grab text-muted-foreground"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </AppSheetModal>
    </>
  );
}
