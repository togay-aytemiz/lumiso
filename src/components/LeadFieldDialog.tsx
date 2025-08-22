import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { 
  LeadFieldDefinition, 
  LeadFieldType,
  FIELD_TYPE_CONFIG,
  CreateLeadFieldDefinition 
} from "@/types/leadFields";

const fieldSchema = z.object({
  label: z.string().min(1, "Field label is required").max(100, "Label is too long"),
  field_type: z.enum(['text', 'textarea', 'email', 'phone', 'date', 'select', 'checkbox', 'number']),
  is_required: z.boolean().default(false),
  is_visible_in_form: z.boolean().default(true),
  options: z.string().optional(),
  validation_rules: z.object({
    min_length: z.number().optional(),
    max_length: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

type FieldFormData = z.infer<typeof fieldSchema>;

interface LeadFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: LeadFieldDefinition | null;
  onClose: () => void;
}

export function LeadFieldDialog({ open, onOpenChange, field, onClose }: LeadFieldDialogProps) {
  const { createFieldDefinition, updateFieldDefinition } = useLeadFieldDefinitions();
  const [loading, setLoading] = useState(false);
  
  const isEdit = !!field;
  const isSystemField = field?.is_system || false;

  const form = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      label: "",
      field_type: "text",
      is_required: false,
      is_visible_in_form: true,
      options: "",
    },
  });

  const selectedFieldType = form.watch("field_type") as LeadFieldType;
  const fieldTypeConfig = FIELD_TYPE_CONFIG[selectedFieldType];

  useEffect(() => {
    if (field && open) {
      form.reset({
        label: field.label,
        field_type: field.field_type as LeadFieldType,
        is_required: field.is_required,
        is_visible_in_form: field.is_visible_in_form,
        options: field.options?.options ? field.options.options.join(", ") : "",
        validation_rules: field.validation_rules as any,
      });
    } else if (!field && open) {
      form.reset({
        label: "",
        field_type: "text",
        is_required: false,
        is_visible_in_form: true,
        options: "",
      });
    }
  }, [field, open, form]);

  const onSubmit = async (data: FieldFormData) => {
    try {
      setLoading(true);
      
      const fieldKey = isEdit ? field.field_key : data.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const fieldData: CreateLeadFieldDefinition = {
        field_key: fieldKey,
        label: data.label,
        field_type: data.field_type,
        is_required: data.is_required,
        is_visible_in_form: data.is_visible_in_form,
        options: fieldTypeConfig.supportsOptions && data.options 
          ? { options: data.options.split(",").map(opt => opt.trim()).filter(Boolean) }
          : null,
        validation_rules: fieldTypeConfig.supportsValidation && data.validation_rules 
          ? data.validation_rules 
          : null,
      };

      if (isEdit) {
        await updateFieldDefinition(field.id, fieldData);
      } else {
        await createFieldDefinition(fieldData);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save field:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Settings className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {isEdit ? "Edit Field" : "Add Custom Field"}
          </DialogTitle>
          <DialogDescription>
            {isEdit 
              ? "Modify the field configuration. System fields have limited editing options."
              : "Create a new custom field to capture additional lead information."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Label *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Budget Range" 
                        {...field}
                        disabled={isSystemField}
                      />
                    </FormControl>
                    <FormDescription>
                      The display name for this field
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="field_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Type *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isSystemField}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(FIELD_TYPE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The data type for this field
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {fieldTypeConfig.supportsOptions && (
              <FormField
                control={form.control}
                name="options"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Options</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Option 1, Option 2, Option 3"
                        {...field}
                        disabled={isSystemField}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of options for this field
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Field Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Configure how this field behaves in your forms
                </p>
              </div>
              <div className="flex items-center gap-6">
                <FormField
                  control={form.control}
                  name="is_required"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSystemField}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">Required</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_visible_in_form"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">Visible in Form</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {isSystemField && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Badge variant="secondary">System Field</Badge>
                <p className="text-sm text-muted-foreground">
                  This is a system field. Some properties cannot be modified.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update Field" : "Create Field"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}