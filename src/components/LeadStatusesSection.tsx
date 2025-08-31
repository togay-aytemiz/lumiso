import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, GripVertical, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AddLeadStatusDialog, EditLeadStatusDialog } from "./settings/LeadStatusDialogs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SettingsSection from "./SettingsSection";
import { useLeadStatuses, useOrganizationSettings } from "@/hooks/useOrganizationData";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { cn } from "@/lib/utils";

const leadStatusSchema = z.object({
  name: z.string().min(1, "Status name is required").max(50, "Status name must be less than 50 characters"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code"),
});

type LeadStatusForm = z.infer<typeof leadStatusSchema>;

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
  is_default: boolean;
  is_system_final?: boolean;
  lifecycle?: string;
}

// Predefined color palette
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

const LeadStatusesSection = () => {
  const [submitting, setSubmitting] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(PREDEFINED_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  
  // Use cached data
  const { data: statuses = [], isLoading } = useLeadStatuses();
  const { data: organizationSettings, isLoading: settingsLoading } = useOrganizationSettings();

  // Check for lifecycle completeness and show warnings
  useEffect(() => {
    if (statuses.length > 0 && !isLoading) {
      const hasCompleted = statuses.some(s => s.lifecycle === 'completed');
      const hasCancelled = statuses.some(s => s.lifecycle === 'cancelled');
      
      if (!hasCompleted || !hasCancelled) {
        const timeoutId = setTimeout(() => {
          toast({
            title: "Tip",
            description: "Add at least one Completed and one Cancelled state to unlock full automations.",
            variant: "default",
            duration: 8000,
          });
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [statuses, isLoading, toast]);

  const form = useForm<LeadStatusForm>({
    resolver: zodResolver(leadStatusSchema),
    defaultValues: {
      name: "",
      color: PREDEFINED_COLORS[0],
    },
  });

  const updateSetting = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('organization_settings')
        .update({ [key]: value })
        .eq('organization_id', organizationId);

      if (error) throw error;

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['organization_settings', activeOrganizationId] });

      toast({
        title: "Success",
        description: "Preferences updated"
      });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (status: LeadStatus) => {
    setEditingStatus(status);
    setSelectedColor(status.color);
    form.reset({ name: status.name, color: status.color });
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingStatus(null);
    form.reset({ name: "", color: PREDEFINED_COLORS[0] });
    setSelectedColor(PREDEFINED_COLORS[0]);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (statusId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if this is a system final status
      const statusToDelete = statuses.find(s => s.id === statusId);
      if (statusToDelete?.is_system_final) {
        throw new Error('Cannot delete system statuses (Completed/Lost). These are required for lead management.');
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', statusId)
        .eq('organization_id', organizationId);

      if (error) {
        if (error.code === '23503') {
          throw new Error('Cannot delete this status because it is being used by existing leads. Please change those leads to a different status first.');
        }
        throw error;
      }

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });

      toast({
        title: "Success",
        description: "Lead status deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting lead status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete lead status",
        variant: "destructive",
      });
    }
  };

  const handleCustomDragEnd = async (result: any) => {
    if (!result.destination) return;

    const customStatuses = statuses.filter(status => !status.is_system_final);
    const systemStatuses = statuses.filter(status => status.is_system_final);
    
    const items = Array.from(customStatuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update sort_order for custom statuses only
      const updates = items.map((status, index) => ({
        id: status.id,
        sort_order: systemStatuses.length + index + 1,
      }));

      // Execute all updates
      for (const update of updates) {
        const { error } = await supabase
          .from('lead_statuses')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });

      toast({
        title: "Success",
        description: "Status order updated successfully",
      });
    } catch (error) {
      console.error('Error updating status order:', error);
      toast({
        title: "Error",
        description: "Failed to update status order",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <SettingsSection 
        title="Lead Statuses" 
        description="Add, rename and reorder statuses to customize your lead workflow."
      >
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse" />
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-24 bg-muted rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </SettingsSection>
    );
  }

  // Get system statuses for dynamic description
  const systemStatuses = statuses.filter(status => status.is_system_final);
  const customStatuses = statuses.filter(status => !status.is_system_final);
  const systemStatusNames = systemStatuses.map(s => s.name).join(' and ');
  const dynamicDescription = systemStatusNames 
    ? `Used for quick actions like marking leads as ${systemStatusNames.toLowerCase()}.`
    : "Used for quick actions like marking leads as completed or lost.";

  const showQuickButtons = organizationSettings?.show_quick_status_buttons ?? true;

  return (
    <>
      <SettingsSection 
        title="Lead Statuses" 
        description="Configure your lead workflow and system status preferences."
      >
        {/* Settings Toggle Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quick-status-buttons" className="text-base">
                Show quick system status buttons on lead details
              </Label>
              <p className="text-sm text-muted-foreground">
                {dynamicDescription}
              </p>
            </div>
            <Switch
              id="quick-status-buttons"
              checked={showQuickButtons}
              onCheckedChange={(checked) => updateSetting('show_quick_status_buttons', checked)}
              disabled={saving || settingsLoading}
            />
          </div>

          {/* System Statuses Section */}
          {showQuickButtons && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">System Statuses</h4>
              
              <div className="flex flex-wrap gap-3">
                {systemStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer hover:opacity-80 transition-all"
                    style={{ 
                      backgroundColor: status.color + '20',
                      color: status.color,
                      border: `1px solid ${status.color}40`
                    }}
                    onClick={() => handleEdit(status)}
                  >
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="uppercase tracking-wide font-semibold">
                      {status.name}
                    </span>
                    {status.lifecycle && status.lifecycle !== 'active' && (
                      <span className="text-xs opacity-60 font-normal capitalize">
                        · {status.lifecycle}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Statuses Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Custom Statuses</h4>
              <Button onClick={handleAdd} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Status
              </Button>
            </div>
            
            <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drag (⋮⋮) to reorder • Click to edit status names and colors.
              </p>
            </div>

            <DragDropContext onDragEnd={handleCustomDragEnd}>
              <Droppable droppableId="custom-statuses" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                      "flex flex-wrap gap-3 min-h-[48px] transition-colors rounded-lg p-2",
                      snapshot.isDraggingOver && "bg-accent/20"
                    )}
                  >
                    {customStatuses.map((status, index) => (
                      <Draggable key={status.id} draggableId={status.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all select-none",
                              snapshot.isDragging ? "opacity-80 shadow-xl scale-105 z-50" : "hover:opacity-80 cursor-pointer",
                              !snapshot.isDragging && "hover:scale-[1.02]"
                            )}
                            style={{ 
                              backgroundColor: status.color + '20',
                              color: status.color,
                              border: `1px solid ${status.color}40`,
                              ...provided.draggableProps.style
                            }}
                          >
                            <div 
                              {...provided.dragHandleProps}
                              className="flex items-center cursor-grab active:cursor-grabbing hover:opacity-70 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-3 h-3 text-current opacity-60" />
                            </div>
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: status.color }}
                            />
                            <span 
                              className="uppercase tracking-wide font-semibold cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(status);
                              }}
                            >
                              {status.name}
                            </span>
                            {status.lifecycle && status.lifecycle !== 'active' && (
                              <span className="text-xs opacity-60 font-normal capitalize">
                                · {status.lifecycle}
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
          </div>
        </div>

        {/* Add Dialog */}
        <AddLeadStatusDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onStatusAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });
          }}
        />

        {/* Edit Dialog */}
        <EditLeadStatusDialog
          status={editingStatus}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onStatusUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['lead_statuses', activeOrganizationId] });
          }}
        />
      </SettingsSection>
    </>
  );
};

export default LeadStatusesSection;