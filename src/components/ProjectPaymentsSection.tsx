import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { EditPaymentDialog } from "./EditPaymentDialog";

interface Payment {
  id: string;
  amount: number;
  description: string | null;
  status: 'paid' | 'due';
  date_paid: string | null;
  created_at: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  extra: boolean;
}

interface ProjectPaymentsSectionProps {
  projectId: string;
  onPaymentsUpdated?: () => void;
}

export function ProjectPaymentsSection({ projectId, onPaymentsUpdated }: ProjectPaymentsSectionProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments((data as Payment[]) || []);
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
      const { data, error } = await supabase
        .from('project_services')
        .select(`
          services (
            id,
            name,
            price,
            extra
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      
      const servicesList = data?.map(ps => ps.services).filter(Boolean) || [];
      setServices(servicesList as Service[]);
    } catch (error: any) {
      console.error('Error fetching project services:', error);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchProjectServices();
  }, [projectId]);

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
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentToDelete.id);

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
  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOutstanding = payments
    .filter(p => p.status === 'due')
    .reduce((sum, p) => sum + p.amount, 0);

  const extraServices = services
    .filter(s => s.extra)
    .reduce((sum, s) => sum + (s.price || 0), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Payments</CardTitle>
            <AddPaymentDialog 
              projectId={projectId} 
              onPaymentAdded={handlePaymentUpdated}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-muted-foreground">Total paid</span>
              </div>
              <div className="text-xl font-semibold">TRY {totalPaid.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-sm font-medium text-muted-foreground">Total outstanding</span>
              </div>
              <div className="text-xl font-semibold">TRY {totalOutstanding.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                <span className="text-sm font-medium text-muted-foreground">Extra services</span>
              </div>
              <div className="text-xl font-semibold">TRY {extraServices.toFixed(2)}</div>
            </div>
          </div>

          {/* Payments Table */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {payment.date_paid 
                          ? format(new Date(payment.date_paid), "MMM d, yyyy")
                          : format(new Date(payment.created_at), "MMM d, yyyy")
                        }
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">TRY {payment.amount.toFixed(2)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-muted-foreground truncate">
                        {payment.description || "No description"}
                      </div>
                    </div>
                    <div>
                      <Badge 
                        variant={payment.status === 'paid' ? 'default' : 'secondary'}
                        className={payment.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}
                      >
                        {payment.status === 'paid' ? 'Paid' : 'Due'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditPayment(payment)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPaymentToDelete(payment);
                        setShowDeleteDialog(true);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Payment Dialog */}
      <EditPaymentDialog
        payment={editingPayment}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onPaymentUpdated={handlePaymentUpdated}
      />

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
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}