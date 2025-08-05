import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

interface EditPaymentDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentUpdated: () => void;
}

export function EditPaymentDialog({ payment, open, onOpenChange, onPaymentUpdated }: EditPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"paid" | "due">("paid");
  const [datePaid, setDatePaid] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  // Reset form when payment changes
  useEffect(() => {
    if (payment && open) {
      setAmount(payment.amount.toString());
      setDescription(payment.description || "");
      setStatus(payment.status);
      setDatePaid(payment.date_paid ? new Date(payment.date_paid) : undefined);
    }
  }, [payment, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!payment || !amount.trim()) {
      toast({
        title: "Error",
        description: "Amount is required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {
        amount: parseFloat(amount),
        description: description.trim() || null,
        status,
        date_paid: status === 'paid' ? datePaid?.toISOString().split('T')[0] : null
      };

      const { error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', payment.id);

      if (error) throw error;

      // If this is a base price payment, update the project's base_price field
      if (payment.type === 'base_price') {
        const { error: projectError } = await supabase
          .from('projects')
          .update({ base_price: parseFloat(amount) })
          .eq('id', payment.project_id);

        if (projectError) {
          console.error('Error updating project base price:', projectError);
          // Don't throw here as the payment was updated successfully
        }
      }

      toast({
        title: "Success",
        description: "Payment updated successfully"
      });

      onOpenChange(false);
      onPaymentUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating payment",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (TRY) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="e.g., Deposit, Final Payment, Balance"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Payment Status</Label>
            <Select value={status} onValueChange={(value: "paid" | "due") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="due">Due</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'paid' && (
            <div className="space-y-2">
              <Label>Date Paid</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !datePaid && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {datePaid ? format(datePaid, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={datePaid}
                    onSelect={setDatePaid}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Updating..." : "Update Payment"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}