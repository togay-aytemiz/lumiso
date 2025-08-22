import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Edit, Trash2, GripVertical, Eye, EyeOff, AlertCircle } from "lucide-react";
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
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { LeadFieldDefinition, FIELD_TYPE_CONFIG } from "@/types/leadFields";

interface LeadFieldsListProps {
  fields: LeadFieldDefinition[];
  onEdit: (field: LeadFieldDefinition) => void;
}

export function LeadFieldsList({ fields, onEdit }: LeadFieldsListProps) {
  const { deleteFieldDefinition, reorderFieldDefinitions } = useLeadFieldDefinitions();
  const [deleteField, setDeleteField] = useState<LeadFieldDefinition | null>(null);

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    try {
      await reorderFieldDefinitions(items);
    } catch (error) {
      console.error('Failed to reorder fields:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteField) return;
    
    try {
      await deleteFieldDefinition(deleteField.id);
      setDeleteField(null);
    } catch (error) {
      console.error('Failed to delete field:', error);
    }
  };

  const getFieldTypeLabel = (fieldType: string) => {
    return FIELD_TYPE_CONFIG[fieldType as keyof typeof FIELD_TYPE_CONFIG]?.label || fieldType;
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No custom fields configured yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first custom field to start collecting additional lead information.
        </p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="fields">
          {(provided) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Visible in Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
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
                              field.is_system ? "opacity-30 cursor-not-allowed" : "cursor-grab"
                            }`}
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.label}</span>
                            {field.is_system && (
                              <Badge variant="secondary" className="text-xs">
                                System
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFieldTypeLabel(field.field_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {field.is_required ? (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Optional
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {field.is_visible_in_form ? (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {field.is_visible_in_form ? "Visible" : "Hidden"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={field.is_system ? "secondary" : "default"}>
                            {field.is_system ? "System" : "Custom"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(field)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!field.is_system && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteField(field)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      <AlertDialog open={!!deleteField} onOpenChange={() => setDeleteField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Custom Field
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteField?.label}"? This will permanently 
              remove the field definition and all data stored in this field for existing leads.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}