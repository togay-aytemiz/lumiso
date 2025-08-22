import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings2, RotateCcw, GripVertical } from 'lucide-react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

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
  const [localPreferences, setLocalPreferences] = useState<ColumnConfig[]>(columnPreferences);
  const [saving, setSaving] = useState(false);

  // Update local preferences when props change
  useEffect(() => {
    setLocalPreferences(columnPreferences);
  }, [columnPreferences]);

  // Get ordered columns for display
  const orderedColumns = availableColumns
    .map(col => {
      const pref = localPreferences.find(p => p.key === col.key);
      return {
        ...col,
        visible: pref?.visible ?? false,
        order: pref?.order ?? 999,
      };
    })
    .sort((a, b) => a.order - b.order);

  const handleToggleColumn = (key: string) => {
    setLocalPreferences(prev => {
      const existing = prev.find(p => p.key === key);
      if (existing) {
        return prev.map(p => 
          p.key === key ? { ...p, visible: !p.visible } : p
        );
      } else {
        const maxOrder = Math.max(...prev.map(p => p.order), 0);
        return [...prev, { key, visible: true, order: maxOrder + 1 }];
      }
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(orderedColumns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order based on new positions
    const newPreferences = items.map((item, index) => ({
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
      console.error('Error saving column preferences:', error);
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
      console.error('Error resetting column preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = localPreferences.filter(p => p.visible).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Customize Columns</span>
          <span className="sm:hidden">Columns</span>
          <Badge variant="secondary" className="ml-1">
            {visibleCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Table Columns</DialogTitle>
          <DialogDescription>
            Choose which columns to display and arrange their order. Drag to reorder columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {visibleCount} of {availableColumns.length} available columns
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Default
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
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
                            flex items-center justify-between p-3 rounded-lg border bg-background
                            ${snapshot.isDragging ? 'shadow-lg' : ''}
                            ${column.visible ? 'border-primary/20 bg-primary/5' : 'border-border'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{column.label}</span>
                                {column.isCore && (
                                  <Badge variant="outline" className="text-xs">
                                    Core
                                  </Badge>
                                )}
                              </div>
                              {column.fieldDefinition && (
                                <span className="text-xs text-muted-foreground">
                                  {column.fieldDefinition.field_type} field
                                </span>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={column.visible}
                            onCheckedChange={() => handleToggleColumn(column.key)}
                            disabled={column.isCore && column.visible}
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

          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <strong>Tip:</strong> Core columns (Status, Assignees, Last Updated) are always visible to ensure essential information is available. You can reorder them but not hide them.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}