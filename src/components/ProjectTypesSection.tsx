import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const projectTypeSchema = z.object({
  name: z.string().min(1, "Type name is required").max(50, "Type name must be less than 50 characters"),
  is_default: z.boolean().default(false),
});

type ProjectTypeForm = z.infer<typeof projectTypeSchema>;

interface ProjectType {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

const ProjectTypesSection = () => {
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<ProjectType | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProjectTypeForm>({
    resolver: zodResolver(projectTypeSchema),
    defaultValues: {
      name: "",
      is_default: false,
    },
  });

  const fetchTypes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // If no types exist, create default ones
      if (!data || data.length === 0) {
        await createDefaultTypes();
        return;
      }

      setTypes(data);
    } catch (error) {
      console.error('Error fetching project types:', error);
      toast({
        title: "Error",
        description: "Failed to load project types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTypes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const defaultTypes = [
        { name: 'Corporate', is_default: false, sort_order: 1 },
        { name: 'Event', is_default: false, sort_order: 2 },
        { name: 'Family', is_default: false, sort_order: 3 },
        { name: 'Maternity', is_default: false, sort_order: 4 },
        { name: 'Newborn', is_default: true, sort_order: 5 },
        { name: 'Portrait', is_default: false, sort_order: 6 },
        { name: 'Wedding', is_default: false, sort_order: 7 },
        { name: 'Other', is_default: false, sort_order: 8 }
      ];

      const { data, error } = await supabase
        .from('project_types')
        .insert(defaultTypes.map(type => ({ ...type, user_id: user.id })))
        .select();

      if (error) throw error;
      setTypes(data);
    } catch (error) {
      console.error('Error creating default types:', error);
      toast({
        title: "Error",
        description: "Failed to create default types",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: ProjectTypeForm) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingType) {
        // Update existing type
        const { error } = await supabase
          .from('project_types')
          .update({ name: data.name, is_default: data.is_default })
          .eq('id', editingType.id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Project type updated successfully",
        });
        setIsEditDialogOpen(false);
      } else {
        // Create new type with the next sort order
        const maxSortOrder = Math.max(...types.map(t => t.sort_order), 0);
        
        const { error } = await supabase
          .from('project_types')
          .insert({
            name: data.name,
            is_default: data.is_default,
            user_id: user.id,
            sort_order: maxSortOrder + 1,
          });

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            throw new Error('A type with this name already exists');
          }
          throw error;
        }

        toast({
          title: "Success",
          description: "Project type created successfully",
        });
        setIsAddDialogOpen(false);
      }

      form.reset({ name: "", is_default: false });
      setEditingType(null);
      fetchTypes();
    } catch (error) {
      console.error('Error saving project type:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save project type",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (type: ProjectType) => {
    setEditingType(type);
    form.reset({ name: type.name, is_default: type.is_default });
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingType(null);
    form.reset({ name: "", is_default: false });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (typeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('project_types')
        .delete()
        .eq('id', typeId)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23503') { // Foreign key constraint violation
          throw new Error('Cannot delete this type because it is being used by existing projects. Please change those projects to a different type first.');
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Project type deleted successfully",
      });
      fetchTypes();
    } catch (error) {
      console.error('Error deleting project type:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete project type",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(types);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for responsive UI
    setTypes(items);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update sort_order for all items
      const updates = items.map((type, index) => ({
        id: type.id,
        sort_order: index + 1,
      }));

      // Execute all updates
      for (const update of updates) {
        const { error } = await supabase
          .from('project_types')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Type order updated successfully",
      });
    } catch (error) {
      console.error('Error updating type order:', error);
      toast({
        title: "Error",
        description: "Failed to update type order",
        variant: "destructive",
      });
      // Revert to original order on error
      fetchTypes();
    }
  };

  const renderTypeDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-medium">
          {isEdit ? 'EDIT TYPE' : 'ADD TYPE'}
        </DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder={isEdit ? "" : "e.g. Corporate, Wedding, Portrait"} 
                    {...field} 
                    className="mt-1"
                  />
                </FormControl>
                <FormMessage />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Customize your project types to reflect the type of work you offer.
                  </p>
                )}
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="is_default"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-medium">
                    Set as default
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    This type will be pre-selected when creating new projects.
                  </p>
                </div>
              </FormItem>
            )}
          />
          
          <div className="flex justify-between items-center pt-4">
            {isEdit && editingType && !editingType.is_default && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project Type</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{editingType?.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (editingType) {
                          handleDelete(editingType.id);
                          setIsEditDialogOpen(false);
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            
            {isEdit && editingType && editingType.is_default && (
              <p className="text-sm text-muted-foreground">
                The default type cannot be deleted. Set another type as default first.
              </p>
            )}
            
            <div className="flex gap-2 ml-auto">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => isEdit ? setIsEditDialogOpen(false) : setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isEdit ? 'Saving...' : 'Adding...'}
                  </>
                ) : (
                  isEdit ? 'Save' : 'Add'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );

  useEffect(() => {
    fetchTypes();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Types</CardTitle>
          <CardDescription>
            Customize your project types to reflect the type of work you offer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Project Types</CardTitle>
            <CardDescription>
              Customize your project types to reflect the type of work you offer.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              form.reset({ name: "", is_default: false });
              setEditingType(null);
            }
          }}>
            <Button 
              onClick={handleAdd}
              className="flex items-center gap-2"
              variant="default"
            >
              <Plus className="h-4 w-4" />
              Add Type
            </Button>
            {renderTypeDialog(false)}
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Drag to reorder:</strong> Use the grip handle (⋮⋮) to drag types and change their order. 
            <strong>Click to edit:</strong> Click on any type to rename it or set it as default. 
            The type order will be consistent across all project views.
          </p>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="types" direction="horizontal">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={cn(
                  "flex flex-wrap gap-3 min-h-[48px] transition-colors rounded-lg p-2",
                  snapshot.isDraggingOver && "bg-accent/20"
                )}
              >
                {types.map((type, index) => (
                  <Draggable key={type.id} draggableId={type.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all select-none border",
                          snapshot.isDragging ? "opacity-80 shadow-xl scale-105 z-50" : "hover:opacity-80 cursor-pointer",
                          !snapshot.isDragging && "hover:scale-[1.02]",
                          type.is_default ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/50 border-muted text-muted-foreground"
                        )}
                        style={provided.draggableProps.style}
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="flex items-center cursor-grab active:cursor-grabbing hover:opacity-70 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-3 h-3 text-current opacity-60" />
                        </div>
                        <span 
                          className="uppercase tracking-wide font-semibold cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(type);
                          }}
                        >
                          {type.name}
                        </span>
                        {type.is_default && (
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
                            DEFAULT
                          </span>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            form.reset({ name: "", is_default: false });
            setEditingType(null);
          }
        }}>
          {renderTypeDialog(true)}
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ProjectTypesSection;