import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddProjectTypeDialog, EditProjectTypeDialog } from "./settings/ProjectTypeDialogs";
import { cn } from "@/lib/utils";
import SettingsSection from "./SettingsSection";

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
        .order('created_at', { ascending: true }); // Order by creation time so new ones go to end

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
        { name: 'Corporate', is_default: false },
        { name: 'Event', is_default: false },
        { name: 'Family', is_default: false },
        { name: 'Maternity', is_default: false },
        { name: 'Newborn', is_default: true },
        { name: 'Portrait', is_default: false },
        { name: 'Wedding', is_default: false },
        { name: 'Other', is_default: false }
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
    console.log('=== PROJECT TYPE SUBMIT START ===');
    console.log('Form data:', data);
    console.log('Editing type:', editingType);
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      console.log('User authenticated:', user.id);

      if (editingType) {
        // Update existing type - let the database trigger handle default switching
        console.log('Updating type:', editingType.id, 'with data:', data);
        const { error } = await supabase
          .from('project_types')
          .update({ name: data.name, is_default: data.is_default })
          .eq('id', editingType.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating type:', error);
          throw error;
        }
        console.log('Successfully updated type');

        // Show appropriate message based on what changed
        if (data.is_default && !editingType.is_default) {
          toast({
            title: "Success",
            description: `"${data.name}" is now the default project type`,
          });
        } else {
          toast({
            title: "Success",
            description: "Project type updated successfully",
          });
        }
        setIsEditDialogOpen(false);
      } else {
        // Create new type - let the database trigger handle default switching
        const { error } = await supabase
          .from('project_types')
          .insert({
            name: data.name,
            is_default: data.is_default,
            user_id: user.id,
          });

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            throw new Error('A type with this name already exists');
          }
          throw error;
        }

        toast({
          title: "Success",
          description: data.is_default ? `"${data.name}" created and set as default` : "Project type created successfully",
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
      <SettingsSection 
        title="Project Types" 
        description="Customize your project types to reflect the type of work you offer."
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection 
        title="Project Types" 
        description="Customize your project types to reflect the type of work you offer."
        action={{
          label: "Add Type",
          onClick: handleAdd,
          icon: <Plus className="h-4 w-4" />
        }}
      >
        <div className="flex flex-wrap gap-3 p-2">
          {types.map((type) => (
            <div
              key={type.id}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all select-none border cursor-pointer hover:opacity-80",
                type.is_default 
                  ? "bg-primary/10 border-primary/20 text-primary" 
                  : "bg-muted/50 border-muted text-muted-foreground hover:bg-muted/70"
              )}
              onClick={() => handleEdit(type)}
            >
              <span className="uppercase tracking-wide font-semibold">
                {type.name}
              </span>
              {type.is_default && (
                <Check className="w-3 h-3 text-primary" />
              )}
            </div>
          ))}
        </div>

        {/* Add Dialog */}
        <AddProjectTypeDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onTypeAdded={fetchTypes}
        />

        {/* Edit Dialog */}
        <EditProjectTypeDialog
          type={editingType}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onTypeUpdated={fetchTypes}
        />
      </SettingsSection>
    </>
  );
};

export default ProjectTypesSection;