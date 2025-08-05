import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Edit2, Trash2, Palette, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const generateRandomColor = () => {
  const colors = ['#A0AEC0', '#ECC94B', '#9F7AEA', '#63B3ED', '#48BB78', '#F56565', '#38B2AC', '#ED8936', '#EC4899', '#8B5CF6'];
  return colors[Math.floor(Math.random() * colors.length)];
};

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
      color: generateRandomColor(),
    },
  });

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

      const defaultStatuses = [
        { name: 'Planned', color: '#A0AEC0' },
        { name: 'Booked', color: '#ECC94B' },
        { name: 'Editing', color: '#9F7AEA' },
        { name: 'Ready to Deliver', color: '#63B3ED' },
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

      form.reset({ name: "", color: generateRandomColor() });
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

      // Check if status is in use by any projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (projectsError) throw projectsError;

      // For now, we'll allow deletion since projects don't have status field yet
      // This check will be needed when projects start using statuses

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

  useEffect(() => {
    fetchStatuses();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Statuses</CardTitle>
          <CardDescription>
            Manage your project pipeline stages with custom statuses and colors
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
            <CardTitle>Project Statuses</CardTitle>
            <CardDescription>
              Manage your project pipeline stages with custom statuses and colors
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Status
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Project Status</DialogTitle>
                <DialogDescription>
                  Create a new status for your project pipeline
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. In Progress" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={field.value}
                              onChange={field.onChange}
                              className="w-12 h-10 rounded border cursor-pointer"
                            />
                            <Input {...field} placeholder="#000000" className="flex-1" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Status'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status Name</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-medium">{status.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: status.color }}
                      title={status.color}
                    />
                    <span className="text-sm text-muted-foreground">{status.color}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(status)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project Status</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{status.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(status.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project Status</DialogTitle>
              <DialogDescription>
                Update the status name and color
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. In Progress" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={field.value}
                            onChange={field.onChange}
                            className="w-12 h-10 rounded border cursor-pointer"
                          />
                          <Input {...field} placeholder="#000000" className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Status'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ProjectStatusesSection;