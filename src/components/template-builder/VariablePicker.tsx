import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Check } from "lucide-react";
import { useTemplateVariables } from "@/hooks/useTemplateVariables";
import type { TemplateVariable } from "@/types/templateBuilder";

interface VariablePickerProps {
  onVariableSelect: (variable: string) => void;
  trigger?: React.ReactNode;
}

export function VariablePicker({ onVariableSelect, trigger }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const { variables, loading } = useTemplateVariables();

  const handleSelect = (variableKey: string) => {
    onVariableSelect(`{${variableKey}}`);
    setOpen(false);
  };

  const groupedVariables = variables.reduce<Record<string, TemplateVariable[]>>((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {});

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
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading variables...
              </div>
            ) : (
              Object.entries(groupedVariables).map(([category, vars]) => (
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
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
