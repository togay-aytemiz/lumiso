import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const projectStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be less than 50 characters"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code"),
});

type ProjectStatusForm = z.infer<typeof projectStatusSchema>;

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Predefined color palette (similar to Pixieset)
const PREDEFINED_COLORS = [
  '#F56565', // Red
  '#ED8936', // Orange  
  '#ECC94B', // Yellow
  '#9AE6B4', // Light Green
  '#48BB78', // Green
  '#38B2AC', // Teal
  '#63B3ED', // Light Blue
  '#4299E1', // Blue
  '#667EEA', // Indigo
  '#9F7AEA', // Purple
  '#ED64A6', // Pink
  '#A0AEC0', // Gray
];

const ProjectStatusesSection = () => {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<ProjectStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProjectStatusForm>({
    resolver: zodResolver(projectStatusSchema),
    defaultValues: {
      name: "",
      color: PREDEFINED_COLORS[0],
    },
  });

  const selectedColor = form.watch("color");

  const fetchStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // If no statuses exist, create default ones
      if (!data || data.length === 0) {
        await createDefaultStatuses();
        return;
      }

      setStatuses(data);
    } catch (error) {
      console.error('Error fetching project statuses:', error);
      toast({
        title: "Error",
        description: "Failed to load project statuses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Updated default statuses as requested
      const defaultStatuses = [
        { name: 'Planned', color: '#A0AEC0' },
        { name: 'Booked', color: '#ECC94B' },
        { name: 'Post Production', color: '#9F7AEA' },
        { name: 'Completed', color: '#48BB78' },
        { name: 'Cancelled', color: '#F56565' }
      ];

      const { data, error } = await supabase
        .from('project_statuses')
        .insert(defaultStatuses.map(status => ({ ...status, user_id: user.id })))
        .select();

      if (error) throw error;
      setStatuses(data);
    } catch (error) {
      console.error('Error creating default statuses:', error);
      toast({
        title: "Error",
        description: "Failed to create default statuses",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: ProjectStatusForm) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingStatus) {
        // Update existing status
        const { error } = await supabase
          .from('project_statuses')
          .update({ name: data.name, color: data.color })
          .eq('id', editingStatus.id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Project status updated successfully",
        });
        setIsEditDialogOpen(false);
      } else {
        // Create new status
        const { error } = await supabase
          .from('project_statuses')
          .insert({
            name: data.name,
            color: data.color,
            user_id: user.id,
          });

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            throw new Error('A status with this name already exists');
          }
          throw error;
        }

        toast({
          title: "Success",
          description: "Project status created successfully",
        });
        setIsAddDialogOpen(false);
      }

      form.reset({ name: "", color: PREDEFINED_COLORS[0] });
      setEditingStatus(null);
      fetchStatuses();
    } catch (error) {
      console.error('Error saving project status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save project status",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (status: ProjectStatus) => {
    setEditingStatus(status);
    form.reset({ name: status.name, color: status.color });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (statusId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('project_statuses')
        .delete()
        .eq('id', statusId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project status deleted successfully",
      });
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting project status:', error);
      toast({
        title: "Error",
        description: "Failed to delete project status",
        variant: "destructive",
      });
    }
  };

  const renderColorSwatches = (onColorSelect: (color: string) => void) => (
    <div className="grid grid-cols-6 gap-2">
      {PREDEFINED_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
            selectedColor === color ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-muted"
          )}
          style={{ backgroundColor: color }}
          onClick={() => onColorSelect(color)}
          title={color}
        />
      ))}
    </div>
  );

  const renderStatusDialog = (isEdit: boolean) => (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-medium">
          {isEdit ? 'EDIT STAGE' : 'ADD STAGE'}
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
                    placeholder={isEdit ? "" : "e.g. Inquiry, Post Production, Completed"} 
                    {...field} 
                    className="mt-1"
                  />
                </FormControl>
                <FormMessage />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Organise your workflow in stages.
                  </p>
                )}
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Stage Color</FormLabel>
                <FormControl>
                  <div className="mt-2">
                    {renderColorSwatches(field.onChange)}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex justify-between items-center pt-4">
            {isEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project Status</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{editingStatus?.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (editingStatus) {
                          handleDelete(editingStatus.id);
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
    fetchStatuses();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Stages</CardTitle>
          <CardDescription>
            Add, rename and reorder stages to customize your workflow.
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
            <CardTitle>Project Stages</CardTitle>
            <CardDescription>
              Add, rename and reorder stages to customize your workflow.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="flex items-center gap-2"
              variant="default"
            >
              <Plus className="h-4 w-4" />
              Add Stage
            </Button>
            {renderStatusDialog(false)}
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Compact status badges display (like Pixieset) */}
        <div className="flex flex-wrap gap-3">
          {statuses.map((status) => (
            <button
              key={status.id}
              onClick={() => handleEdit(status)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
              style={{ 
                backgroundColor: status.color + '20',
                color: status.color,
                border: `1px solid ${status.color}40`
              }}
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: status.color }}
              />
              <span className="uppercase tracking-wide font-semibold">{status.name}</span>
            </button>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          {renderStatusDialog(true)}
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ProjectStatusesSection;