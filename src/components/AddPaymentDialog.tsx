import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn, getUserLocale } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";

interface AddPaymentDialogProps {
  projectId: string;
  onPaymentAdded: () => void;
}

export function AddPaymentDialog({ projectId, onPaymentAdded }: AddPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"paid" | "due">("paid");
  const [datePaid, setDatePaid] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const browserLocale = getUserLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount.trim()) {
      toast({
        title: "Error",
        description: "Amount is required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('payments')
        .insert({
          project_id: projectId,
          user_id: user.id,
          amount: parseFloat(amount),
          description: description.trim() || null,
          status,
          date_paid: status === 'paid' ? datePaid?.toISOString().split('T')[0] : null,
          type: 'manual'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment added successfully"
      });

      // Reset form
      setAmount("");
      setDescription("");
      setStatus("paid");
      setDatePaid(new Date());
      setOpen(false);
      onPaymentAdded();
    } catch (error: any) {
      toast({
        title: "Error adding payment",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = Boolean(amount.trim() || description.trim() || status !== "paid");

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      setAmount("");
      setDescription("");
      setStatus("paid");
      setDatePaid(new Date());
      setOpen(false);
    }
  };

  const handleSubmitClick = () => {
    const event = { preventDefault: () => {} } as React.FormEvent;
    handleSubmit(event);
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => setOpen(false),
      variant: "outline" as const,
      disabled: isLoading
    },
    {
      label: isLoading ? "Adding..." : "Add Payment",
      onClick: handleSubmitClick,
      disabled: isLoading || !amount.trim(),
      loading: isLoading
    }
  ];

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add
      </Button>

      <AppSheetModal
        title="Add Payment"
        isOpen={open}
        onOpenChange={setOpen}
        size="content"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-4">
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
                <PopoverContent className="w-auto min-w-[18rem] p-0 rounded-xl border border-border shadow-md" align="start">
                  <div className="p-2">
                    <ReactCalendar
                      className="react-calendar w-full p-2 pointer-events-auto"
                      locale={browserLocale}
                      view="month"
                      minDetail="month"
                      next2Label={null}
                      prev2Label={null}
                      onChange={(value) => {
                        const d = Array.isArray(value) ? value[0] : value;
                        const date = d instanceof Date ? d : undefined;
                        setDatePaid(date);
                      }}
                      value={datePaid ?? null}
                      formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date)}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </AppSheetModal>
    </>
  );
}