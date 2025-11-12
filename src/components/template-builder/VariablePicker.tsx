import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Check } from "lucide-react";
import type { TemplateVariable } from "@/types/templateBuilder";
import { useTranslation } from "react-i18next";
import { useTemplateVariablesContext } from "@/contexts/TemplateVariablesContext";

interface VariablePickerProps {
  onVariableSelect: (variable: string) => void;
  trigger?: React.ReactNode;
}

export function VariablePicker({ onVariableSelect, trigger }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const { variables, loading } = useTemplateVariablesContext();
  const { t } = useTranslation("pages");

  const handleSelect = (variable: TemplateVariable) => {
    const trimmedLabel = variable.label?.trim();
    const token = trimmedLabel && trimmedLabel.length > 0
      ? `{${variable.key}|${trimmedLabel}}`
      : `{${variable.key}}`;
    onVariableSelect(token);
    setOpen(false);
  };

  const groupedVariables = variables.reduce<Record<string, TemplateVariable[]>>((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {});

  type VariableCategory = TemplateVariable["category"];
  const categoryLabels: Record<VariableCategory, string> = {
    business: t("templateBuilder.variables.categories.business"),
    lead: t("templateBuilder.variables.categories.lead"),
    session: t("templateBuilder.variables.categories.session"),
    project: t("templateBuilder.variables.categories.project"),
    custom: t("templateBuilder.variables.categories.custom"),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-3 w-3" />
            {t("templateBuilder.variablePicker.trigger")}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("templateBuilder.variablePicker.search") ?? undefined} />
          <CommandList>
            <CommandEmpty>{t("templateBuilder.variablePicker.empty")}</CommandEmpty>
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                {t("templateBuilder.variablePicker.loading")}
              </div>
            ) : (
              Object.entries(groupedVariables).map(([category, vars]) => (
                <CommandGroup
                  key={category}
                  heading={categoryLabels[category as VariableCategory] || category}
                >
                  {vars.map((variable) => (
                    <CommandItem
                      key={variable.key}
                      onSelect={() => handleSelect(variable)}
                      className="cursor-pointer"
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      <span className="font-medium">{variable.label}</span>
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
