import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Edit2, Trash2, Lock, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { EditPaymentDialog } from "./EditPaymentDialog";
interface Payment {
  id: string;
  project_id: string;
  amount: number;
  description: string | null;
  status: 'paid' | 'due';
  date_paid: string | null;
  created_at: string;
  type: 'base_price' | 'manual';
}
interface Service {
  id: string;
  name: string;
  price: number; // Deprecated - keeping for backward compatibility
  extra: boolean;
  cost_price?: number;
  selling_price?: number;
}
interface Project {
  id: string;
  base_price: number;
}
interface ProjectPaymentsSectionProps {
  projectId: string;
  onPaymentsUpdated?: () => void;
  refreshToken?: number;
}
export function ProjectPaymentsSection({
  projectId,
  onPaymentsUpdated,
  refreshToken
}: ProjectPaymentsSectionProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [basePrice, setBasePrice] = useState("");
  const [isUpdatingBasePrice, setIsUpdatingBasePrice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    toast
  } = useToast();
  const fetchProject = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('projects').select('id, base_price').eq('id', projectId).single();
      if (error) throw error;
      setProject(data);
      setBasePrice(data.base_price?.toString() || "0");
    } catch (error: any) {
      console.error('Error fetching project:', error);
    }
  };
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('payments').select('*').eq('project_id', projectId).order('type', {
        ascending: false
      }) // base_price first
      .order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setPayments(data as Payment[] || []);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Error loading payments",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchProjectServices = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('project_services').select(`
          services (
            id,
            name,
            price,
            extra,
            cost_price,
            selling_price
          )
        `).eq('project_id', projectId);
      if (error) throw error;
      const servicesList = data?.map(ps => ps.services).filter(Boolean) || [];
      setServices(servicesList as Service[]);
    } catch (error: any) {
      console.error('Error fetching project services:', error);
    }
  };
  useEffect(() => {
    fetchProject();
    fetchPayments();
    fetchProjectServices();
  }, [projectId, refreshToken]);

  // Ensure base price payment exists
  useEffect(() => {
    const ensureBasePricePayment = async () => {
      if (!project) return;
      const existingBasePricePayment = payments.find(p => p.type === 'base_price');
      if (!existingBasePricePayment) {
        try {
          const {
            data: {
              user
            }
          } = await supabase.auth.getUser();
          if (!user) return;
          const {
            error
          } = await supabase.from('payments').insert({
            project_id: projectId,
            user_id: user.id,
            amount: project.base_price || 0,
            description: 'Base Price',
            status: 'due',
            type: 'base_price'
          });
          if (!error) {
            fetchPayments();
          }
        } catch (error) {
          console.error('Error creating base price payment:', error);
        }
      }
    };
    if (project && payments.length > 0) {
      ensureBasePricePayment();
    }
  }, [project, payments, projectId]);
  const handlePaymentUpdated = () => {
    fetchPayments();
    onPaymentsUpdated?.();
  };
  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setShowEditDialog(true);
  };
  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      const {
        error
      } = await supabase.from('payments').delete().eq('id', paymentToDelete.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Payment deleted successfully"
      });
      fetchPayments();
      onPaymentsUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error deleting payment",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setPaymentToDelete(null);
    }
  };

  // Calculate totals
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const totalDue = payments.filter(p => p.status === 'due').reduce((sum, p) => sum + p.amount, 0);
  const extraServices = services.reduce((sum, s) => sum + (s.selling_price || s.price || 0), 0);

  // Remaining Balance = Base Price + Due Payments + Extra Services - Paid Payments
  const remainingBalance = totalDue + extraServices - totalPaid;
  return <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold"><CreditCard className="h-4 w-4" />Payments</CardTitle>
            <AddPaymentDialog projectId={projectId} onPaymentAdded={handlePaymentUpdated} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-4 md:grid-cols-3">
            {/* Mobile: Single column stack, Desktop: 3 columns */}
            <div className="md:text-center col-span-3 md:col-span-1">
              <div className="flex items-center gap-2 mb-1 md:justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                <span className="text-sm font-medium text-muted-foreground flex-1 md:flex-none">Total paid</span>
                <div className="text-lg font-semibold md:hidden">TRY {Math.round(totalPaid)}</div>
              </div>
              <div className="text-xl font-semibold hidden md:block">TRY {Math.round(totalPaid)}</div>
            </div>
            <div className="md:text-center col-span-3 md:col-span-1">
              <div className="flex items-center gap-2 mb-1 md:justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></div>
                <span className="text-sm font-medium text-muted-foreground flex-1 md:flex-none">Extra services</span>
                <div className="text-lg font-semibold md:hidden">TRY {Math.round(extraServices)}</div>
              </div>
              <div className="text-xl font-semibold hidden md:block">TRY {Math.round(extraServices)}</div>
            </div>
            <div className="md:text-center col-span-3 md:col-span-1">
              <div className="flex items-center gap-2 mb-1 md:justify-center">
                <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></div>
                <span className="text-sm font-medium text-muted-foreground flex-1 md:flex-none">Remaining balance</span>
                <div className="text-lg font-semibold md:hidden">TRY {Math.round(remainingBalance)}</div>
              </div>
              <div className="text-xl font-semibold hidden md:block">TRY {Math.round(remainingBalance)}</div>
            </div>
          </div>

          {/* Payments Table */}
          {loading ? <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
            </div> : payments.length === 0 && (project?.base_price || 0) === 0 ? <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet. Set a base price to get started.
            </div> : <div className="space-y-3">
              {payments.map(payment => <div key={payment.id} className={`border rounded-lg transition-colors ${payment.type === 'base_price' ? 'bg-muted/30 border-muted-foreground/20' : 'hover:bg-muted/50'}`}>
                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center justify-between p-3">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {payment.date_paid ? format(new Date(payment.date_paid), "MMM d, yyyy") : format(new Date(payment.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold">TRY {Math.round(payment.amount)}</div>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="text-sm text-muted-foreground truncate">
                          {payment.description || "No description"}
                        </div>
                      </div>
                      <div>
                        <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className={payment.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}>
                          {payment.status === 'paid' ? 'Paid' : 'Due'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => handleEditPayment(payment)} className="h-8 w-8 p-0">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {payment.type === 'manual' && <Button variant="ghost" size="sm" onClick={() => {
                  setPaymentToDelete(payment);
                  setShowDeleteDialog(true);
                }} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden p-2.5 space-y-2.5">
                    {/* Row 1: Date + Amount */}
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">
                        {payment.date_paid ? format(new Date(payment.date_paid), "MMM d, yyyy") : format(new Date(payment.created_at), "MMM d, yyyy")}
                      </div>
                      <div className="font-semibold">TRY {Math.round(payment.amount)}</div>
                    </div>
                    
                    {/* Row 2: Description (if exists) */}
                    {payment.description && <div className="text-sm text-muted-foreground truncate">
                        {payment.description}
                      </div>}
                    
                    {/* Row 3: Status + Actions */}
                    <div className="flex items-center justify-between">
                      <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className={payment.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}>
                        {payment.status === 'paid' ? 'Paid' : 'Due'}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPayment(payment)} className="h-8 w-8 p-0">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {payment.type === 'manual' && <Button variant="ghost" size="sm" onClick={() => {
                    setPaymentToDelete(payment);
                    setShowDeleteDialog(true);
                  }} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>}
                      </div>
                    </div>
                  </div>
                </div>)}
            </div>}
        </CardContent>
      </Card>

      {/* Edit Payment Dialog */}
      <EditPaymentDialog payment={editingPayment} open={showEditDialog} onOpenChange={setShowEditDialog} onPaymentUpdated={handlePaymentUpdated} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting..." : "Delete Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>;
}