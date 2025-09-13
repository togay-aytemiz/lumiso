import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Calendar, CreditCard, CheckCircle2, Users } from "lucide-react";
import { format } from "date-fns";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { useProjectPayments } from "@/hooks/useProjectPayments";
import ClientDetailsCard from "@/components/ClientDetailsCard";

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
  assignees?: string[];
  project_type_id?: string | null;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
}

interface ProjectType {
  id: string;
  name: string;
}

interface ProjectSheetPreviewProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectUpdated?: () => void;
}

export default function ProjectSheetPreview({ 
  project, 
  open, 
  onOpenChange, 
  onProjectUpdated 
}: ProjectSheetPreviewProps) {
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const { progress, loading: progressLoading } = useProjectProgress(project?.id || "", refreshTrigger);
  const { paymentSummary, loading: paymentsLoading } = useProjectPayments(project?.id || "", refreshTrigger);

  const fetchLead = async () => {
    if (!project?.lead_id) return;
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, notes')
        .eq('id', project.lead_id)
        .single();

      if (error) throw error;
      setLead(data);
    } catch (error: any) {
      console.error('Error fetching lead:', error);
    }
  };

  const fetchProjectType = async () => {
    if (!project?.project_type_id) return;
    
    try {
      const { data, error } = await supabase
        .from('project_types')
        .select('id, name')
        .eq('id', project.project_type_id)
        .single();

      if (error) throw error;
      setProjectType(data);
    } catch (error: any) {
      console.error('Error fetching project type:', error);
    }
  };

  const checkArchiveStatus = async () => {
    if (!project?.status_id) {
      setIsArchived(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('project_statuses')
        .select('name')
        .eq('id', project.status_id)
        .maybeSingle();

      setIsArchived((data?.name || '').toLowerCase() === 'archived');
    } catch {
      setIsArchived(false);
    }
  };

  useEffect(() => {
    if (project && open) {
      fetchLead();
      fetchProjectType();
      checkArchiveStatus();
    }
  }, [project, open]);

  const handleStatusChange = () => {
    checkArchiveStatus();
    setRefreshTrigger(prev => prev + 1);
    onProjectUpdated?.();
  };

  const handleViewFullDetails = () => {
    if (project) {
      navigate(`/projects/${project.id}`);
      onOpenChange(false);
    }
  };

  const handleScheduleSession = () => {
    // Implementation for scheduling session
    console.log('Schedule session for project:', project?.id);
  };

  const handleAddPayment = () => {
    // Implementation for adding payment
    console.log('Add payment for project:', project?.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!project) return null;

  const footerActions = [
    {
      label: "View Full Details",
      onClick: handleViewFullDetails,
      variant: "default" as const
    }
  ];

  return (
    <AppSheetModal
      isOpen={open}
      onOpenChange={onOpenChange}
      title={project.name}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        {/* Project Overview */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  {isArchived && (
                    <Badge variant="secondary" className="text-xs">
                      Archived
                    </Badge>
                  )}
                  {projectType && (
                    <Badge variant="outline" className="text-xs">
                      {projectType.name.toUpperCase()}
                    </Badge>
                  )}
                </div>
                
                {project.description && (
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Created {format(new Date(project.created_at), "MMM d, yyyy")}</span>
                  {project.updated_at !== project.created_at && (
                    <span>Updated {format(new Date(project.updated_at), "MMM d, yyyy")}</span>
                  )}
                </div>
              </div>

              {project.assignees && project.assignees.length > 0 && (
                <div className="text-muted-foreground text-xs">
                  {project.assignees.length} assignee{project.assignees.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status and Progress */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Progress
                </div>
                {!progressLoading && progress.total > 0 ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{progress.completed}/{progress.total} tasks</span>
                      <span className="font-medium">{progress.percentage}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tasks yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Status
                </div>
                {!isArchived && (
                  <ProjectStatusBadge 
                    projectId={project.id}
                    currentStatusId={project.status_id}
                    onStatusChange={handleStatusChange}
                    editable={true}
                    size="sm"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Summary */}
        {!paymentsLoading && paymentSummary.totalProject > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4" />
                  Payments
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Paid</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(paymentSummary.totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium">
                      {formatCurrency(paymentSummary.totalProject)}
                    </span>
                  </div>
                  {paymentSummary.remaining > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Remaining</span>
                      <span className="font-medium text-orange-600">
                        {formatCurrency(paymentSummary.remaining)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Details */}
        {lead && (
          <ClientDetailsCard
            title="Client Information"
            name={lead.name}
            email={lead.email}
            phone={lead.phone}
            notes={lead.notes}
            showQuickActions={false}
            clampNotes={true}
            onNameClick={() => navigate(`/leads/${lead.id}`)}
          />
        )}

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleScheduleSession}
                  className="justify-start"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Session
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddPayment}
                  className="justify-start"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppSheetModal>
  );
}