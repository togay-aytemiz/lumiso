import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings2, RotateCcw, GripVertical } from "lucide-react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";

interface ColumnConfig {
  key: string;
  visible: boolean;
  order: number;
}

interface AvailableColumn {
  key: string;
  label: string;
  isCore: boolean;
  fieldDefinition?: any;
}

interface LeadTableColumnManagerProps {
  columnPreferences: ColumnConfig[];
  availableColumns: AvailableColumn[];
  onSave: (preferences: ColumnConfig[]) => Promise<void>;
  onReset: () => Promise<void>;
}

export function LeadTableColumnManager({
  columnPreferences,
  availableColumns,
  onSave,
  onReset,
}: LeadTableColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const [localPreferences, setLocalPreferences] =
    useState<ColumnConfig[]>(columnPreferences);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation("common");

  // Update local preferences when props change
  useEffect(() => {
    setLocalPreferences(columnPreferences);
  }, [columnPreferences]);

  // Get ordered columns for display
  const orderedColumns = availableColumns
    .map((col) => {
      const pref = localPreferences.find((p) => p.key === col.key);
      return {
        ...col,
        visible: pref?.visible ?? false,
        order: pref?.order ?? 999,
      };
    })
    .sort((a, b) => a.order - b.order);

  const handleToggleColumn = (key: string) => {
    setLocalPreferences((prev) => {
      const existing = prev.find((p) => p.key === key);
      if (existing) {
        return prev.map((p) =>
          p.key === key ? { ...p, visible: !p.visible } : p
        );
      } else {
        const maxOrder = Math.max(...prev.map((p) => p.order), 0);
        const newPrefs = [...prev, { key, visible: true, order: maxOrder + 1 }];

        // Deduplicate to prevent any duplicates from creeping in
        const seen = new Set<string>();
        return newPrefs.filter((p) => {
          if (seen.has(p.key)) return false;
          seen.add(p.key);
          return true;
        });
      }
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(orderedColumns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order based on new positions and ensure uniqueness
    const seen = new Set<string>();
    const newPreferences = items
      .filter((item) => {
        if (seen.has(item.key)) {
          return false; // Skip duplicates
        }
        seen.add(item.key);
        return true;
      })
      .map((item, index) => ({
        key: item.key,
        visible: item.visible,
        order: index + 1,
      }));

    setLocalPreferences(newPreferences);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(localPreferences);
      setOpen(false);
    } catch (error) {
      console.error("Error saving column preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      await onReset();
      setOpen(false);
    } catch (error) {
      console.error("Error resetting column preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = localPreferences.filter((p) => p.visible).length;

  const footerActions = [
    {
      label: t("buttons.cancel"),
      onClick: () => setOpen(false),
      variant: "outline" as const,
      disabled: saving,
    },
    {
      label: saving ? t("actions.saving") : t("buttons.save_changes"),
      onClick: handleSave,
      disabled: saving,
      loading: saving,
    },
  ];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
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
        footerActions={footerActions}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("table.chooseColumnsDescription")}
          </p>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("labels.visible_columns", {
                visible: visibleCount,
                total: availableColumns.length,
              })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {t("buttons.reset")}
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1.5"
                >
                  {orderedColumns.map((column, index) => (
                    <Draggable
                      key={column.key}
                      draggableId={column.key}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`
                            flex items-center justify-between p-2 rounded-md border text-sm
                            ${snapshot.isDragging ? "shadow-md" : ""}
                            ${
                              column.visible
                                ? "border-primary/20 bg-primary/5"
                                : "border-border"
                            }
                          `}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium truncate">
                                  {column.label}
                                </span>
                                {column.isCore && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 h-4"
                                  >
                                    {t("table.core")}
                                  </Badge>
                                )}
                              </div>
                              {column.fieldDefinition && (
                                <div className="text-[10px] text-muted-foreground">
                                  {column.fieldDefinition.field_type}
                                </div>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={column.visible}
                            onCheckedChange={() =>
                              handleToggleColumn(column.key)
                            }
                            disabled={column.isCore && column.visible}
                            className="flex-shrink-0"
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded text-center">
            {t("table.coreColumnsNote")}
          </div>
        </div>
      </AppSheetModal>
    </>
  );
}
