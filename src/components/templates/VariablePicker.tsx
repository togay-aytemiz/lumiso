import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";

const VARIABLE_GROUPS = [
  {
    label: "Client Information",
    variables: [
      { key: 'client_name', label: 'Client Name' },
      { key: 'customer_name', label: 'Customer Name' },
      { key: 'lead_name', label: 'Lead Name' },
      { key: 'customer_email', label: 'Customer Email' },
      { key: 'client_email', label: 'Client Email' },
      { key: 'customer_phone', label: 'Customer Phone' },
      { key: 'client_phone', label: 'Client Phone' }
    ]
  },
  {
    label: "Session Details", 
    variables: [
      { key: 'session_type', label: 'Session Type' },
      { key: 'session_date', label: 'Session Date' },
      { key: 'session_time', label: 'Session Time' },
      { key: 'session_location', label: 'Session Location' }
    ]
  },
  {
    label: "Studio Information",
    variables: [
      { key: 'studio_name', label: 'Studio Name' },
      { key: 'business_name', label: 'Business Name' },
      { key: 'studio_phone', label: 'Studio Phone' },
      { key: 'studio_email', label: 'Studio Email' }
    ]
  },
  {
    label: "Project & Payment",
    variables: [
      { key: 'project_name', label: 'Project Name' },
      { key: 'payment_amount', label: 'Payment Amount' },
      { key: 'payment_due_date', label: 'Payment Due Date' },
      { key: 'total_amount', label: 'Total Amount' },
      { key: 'remaining_balance', label: 'Remaining Balance' }
    ]
  },
  {
    label: "Actions & Links",
    variables: [
      { key: 'booking_link', label: 'Booking Link' },
      { key: 'reschedule_link', label: 'Reschedule Link' },
      { key: 'gallery_link', label: 'Gallery Link' }
    ]
  },
  {
    label: "Reminders",
    variables: [
      { key: 'reminder_title', label: 'Reminder Title' },
      { key: 'reminder_date', label: 'Reminder Date' }
    ]
  }
];

interface VariablePickerProps {
  onVariableSelect: (key: string) => void;
  className?: string;
}

export function VariablePicker({ onVariableSelect, className }: VariablePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Plus className="w-4 h-4 mr-2" />
          Insert Variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 z-50" align="start">
        {VARIABLE_GROUPS.map((group, groupIndex) => (
          <div key={group.label}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.variables.map((variable) => (
              <DropdownMenuItem
                key={variable.key}
                onClick={() => onVariableSelect(`{{${variable.key}}}`)}
                className="cursor-pointer"
              >
                {variable.label}
              </DropdownMenuItem>
            ))}
            {groupIndex < VARIABLE_GROUPS.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}