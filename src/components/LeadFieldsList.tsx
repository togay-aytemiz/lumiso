import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import {
  Edit,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LeadFieldDefinition, FIELD_TYPE_CONFIG } from "@/types/leadFields";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";

interface LeadFieldsListProps {
  fields: LeadFieldDefinition[];
  onEdit: (field: LeadFieldDefinition) => void;
  onDelete: (id: string) => Promise<void>;
  onReorder: (fields: LeadFieldDefinition[]) => Promise<void>;
}

export function LeadFieldsList({
  fields,
  onEdit,
  onDelete,
  onReorder,
}: LeadFieldsListProps) {
  const [deleteField, setDeleteField] = useState<LeadFieldDefinition | null>(
    null
  );
  const { t } = useTranslation("forms");
  const isMobile = useIsMobile();

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    try {
      await onReorder(items);
    } catch (error) {
      console.error("Failed to reorder fields:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteField) return;

    try {
      await onDelete(deleteField.id);
      setDeleteField(null);
    } catch (error) {
      console.error("Failed to delete field:", error);
    }
  };

  const getFieldTypeLabel = (fieldType: string) => {
    return (
      FIELD_TYPE_CONFIG[fieldType as keyof typeof FIELD_TYPE_CONFIG]?.label ||
      fieldType
    );
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("lead_fields.no_fields")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("lead_fields.no_fields_description")}
        </p>
      </div>
    );
  }

  const mobileContent = (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="fields-mobile">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-3"
          >
            {fields.map((field, index) => (
              <Draggable
                key={field.id}
                draggableId={field.id}
                index={index}
                isDragDisabled={field.is_system}
              >
                {(provided, snapshot) => {
                  const dragHandleProps: Record<string, unknown> = !field.is_system
                    ? (provided.dragHandleProps ?? {})
                    : {};
                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-shadow",
                        snapshot.isDragging && "shadow-lg ring-2 ring-primary/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <p className="text-base font-semibold leading-tight text-foreground break-words">
                            {field.label}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <span>{getFieldTypeLabel(field.field_type)}</span>
                            <Badge variant="secondary">
                              {field.is_system
                                ? t("lead_fields.table.system_value")
                                : t("lead_fields.table.custom_value")}
                            </Badge>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={cn(
                            "rounded-md p-2 text-muted-foreground/70 transition-colors",
                            field.is_system
                              ? "cursor-not-allowed opacity-30"
                              : "cursor-grab active:cursor-grabbing hover:text-foreground"
                          )}
                          aria-label="Reorder field"
                          disabled={field.is_system}
                          {...dragHandleProps}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">
                            {t("lead_fields.table.required")}:
                          </span>{" "}
                          {field.is_required
                            ? t("lead_fields.table.required_value")
                            : t("lead_fields.table.optional_value")}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {t("lead_fields.table.visible_in_form")}:
                          </span>
                          <span className="inline-flex items-center gap-1">
                            {field.is_visible_in_form ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                            {field.is_visible_in_form
                              ? t("lead_fields.table.visible_value")
                              : t("lead_fields.table.hidden_value")}
                          </span>
                        </div>
                      </div>

                      <IconActionButtonGroup className="mt-4">
                        <IconActionButton onClick={() => onEdit(field)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </IconActionButton>
                        {!field.is_system && (
                          <IconActionButton
                            onClick={() => setDeleteField(field)}
                            variant="danger"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </IconActionButton>
                        )}
                      </IconActionButtonGroup>
                    </div>
                  );
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  const desktopContent = (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="fields">
        {(provided) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t("lead_fields.table.field_name")}</TableHead>
                <TableHead>{t("lead_fields.table.type")}</TableHead>
                <TableHead>{t("lead_fields.table.required")}</TableHead>
                <TableHead>
                  {t("lead_fields.table.visible_in_form")}
                </TableHead>
                <TableHead>{t("lead_fields.table.status")}</TableHead>
                <TableHead className="w-24">
                  {t("lead_fields.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody {...provided.droppableProps} ref={provided.innerRef}>
              {fields.map((field, index) => (
                <Draggable
                  key={field.id}
                  draggableId={field.id}
                  index={index}
                  isDragDisabled={field.is_system}
                >
                  {(provided, snapshot) => (
                    <TableRow
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <div
                          {...provided.dragHandleProps}
                          className={`flex items-center justify-center ${
                            field.is_system
                              ? "opacity-30 cursor-not-allowed"
                              : "cursor-grab"
                          }`}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{field.label}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {getFieldTypeLabel(field.field_type)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {field.is_required
                            ? t("lead_fields.table.required_value")
                            : t("lead_fields.table.optional_value")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {field.is_visible_in_form ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {field.is_visible_in_form
                              ? t("lead_fields.table.visible_value")
                              : t("lead_fields.table.hidden_value")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {field.is_system
                            ? t("lead_fields.table.system_value")
                            : t("lead_fields.table.custom_value")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <IconActionButtonGroup>
                          <IconActionButton onClick={() => onEdit(field)}>
                            <Edit className="h-4 w-4" />
                          </IconActionButton>
                          {!field.is_system && (
                            <IconActionButton
                              onClick={() => setDeleteField(field)}
                              variant="danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconActionButton>
                          )}
                        </IconActionButtonGroup>
                      </TableCell>
                    </TableRow>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </TableBody>
          </Table>
        )}
      </Droppable>
    </DragDropContext>
  );

  return (
    <>
      {isMobile ? mobileContent : desktopContent}

      <AlertDialog
        open={!!deleteField}
        onOpenChange={() => setDeleteField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("lead_fields.delete_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("lead_fields.delete_dialog.description", {
                fieldName: deleteField?.label,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("lead_fields.delete_dialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("lead_fields.delete_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
