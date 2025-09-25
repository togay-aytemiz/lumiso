import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
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
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

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
  const { t } = useFormsTranslation();

  // Reset form when payment changes
  useEffect(() => {
    if (payment && open) {
      setAmount(payment.amount.toString());
      setDescription(payment.description || "");
      setStatus(payment.status);
      setDatePaid(payment.date_paid ? new Date(payment.date_paid) : undefined);
    }
  }, [payment, open]);

  const handleSubmit = async () => {
    if (!payment || !amount.trim()) {
      toast({
        title: t('messages.error.generic'),
        description: t('edit_payment.amount_required'),
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
        title: t('messages.success.updated'),
        description: t('edit_payment.payment_updated')
      });

      onOpenChange(false);
      onPaymentUpdated();
    } catch (error: any) {
      toast({
        title: t('messages.error.save'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate isDirty state (safe for null payment)
  const isDirty = Boolean(
    payment && (
      amount !== payment.amount.toString() ||
      description !== (payment.description || "") ||
      status !== payment.status ||
      (status === 'paid' && datePaid?.toISOString().split('T')[0] !== payment.date_paid)
    )
  );

  // Always call hooks before any early returns
  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      onOpenChange(false);
    },
  });

  // Early return after all hooks are called
  if (!payment) return null;

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('buttons.cancel'),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: isLoading
    },
    {
      label: isLoading ? t('edit_payment.updating') : t('edit_payment.update_payment'),
      onClick: handleSubmit,
      disabled: isLoading || !amount.trim(),
      loading: isLoading
    }
  ];

  return (
    <>
      <AppSheetModal
        title={t('edit_payment.title')}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="content"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">{t('edit_payment.amount_try')} *</Label>
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
            <Label htmlFor="description">{t('edit_payment.description')}</Label>
            <Textarea
              id="description"
              placeholder={t('edit_payment.description_placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('edit_payment.payment_status')}</Label>
            <Select value={status} onValueChange={(value: "paid" | "due") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">{t('edit_payment.paid')}</SelectItem>
                <SelectItem value="due">{t('edit_payment.due')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'paid' && (
            <div className="space-y-2">
              <Label>{t('edit_payment.date_paid')}</Label>
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
                    {datePaid ? format(datePaid, "PPP") : <span>{t('edit_payment.pick_date')}</span>}
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
        </div>
      </AppSheetModal>
      
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}