import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Check } from "lucide-react";

interface Variable {
  key: string;
  label: string;
  category: string;
}

const variables: Variable[] = [
  // Lead fields
  { key: "customer_name", label: "Customer Name", category: "Lead" },
  { key: "customer_email", label: "Customer Email", category: "Lead" },
  { key: "customer_phone", label: "Customer Phone", category: "Lead" },
  
  // Session fields
  { key: "session_date", label: "Session Date", category: "Session" },
  { key: "session_time", label: "Session Time", category: "Session" },
  { key: "session_location", label: "Session Location", category: "Session" },
  { key: "session_notes", label: "Session Notes", category: "Session" },
  
  // Business fields
  { key: "business_name", label: "Business Name", category: "Business" },
  { key: "business_phone", label: "Business Phone", category: "Business" },
  { key: "business_email", label: "Business Email", category: "Business" },
  { key: "business_address", label: "Business Address", category: "Business" },
];

interface VariablePickerProps {
  onVariableSelect: (variable: string) => void;
  trigger?: React.ReactNode;
}

export function VariablePicker({ onVariableSelect, trigger }: VariablePickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (variableKey: string) => {
    onVariableSelect(`{${variableKey}}`);
    setOpen(false);
  };

  const groupedVariables = variables.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, Variable[]>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-3 w-3" />
            Variable
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search variables..." />
          <CommandList>
            <CommandEmpty>No variables found.</CommandEmpty>
            {Object.entries(groupedVariables).map(([category, vars]) => (
              <CommandGroup key={category} heading={category}>
                {vars.map((variable) => (
                  <CommandItem
                    key={variable.key}
                    onSelect={() => handleSelect(variable.key)}
                    className="cursor-pointer"
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    <div>
                      <div className="font-medium">{variable.label}</div>
                      <div className="text-xs text-muted-foreground">{`{${variable.key}}`}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}