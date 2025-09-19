import { Settings, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useKanbanSettings } from "@/hooks/useKanbanSettings";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface KanbanSettingsSheetProps {
  children?: React.ReactNode;
}

export function KanbanSettingsSheet({ children }: KanbanSettingsSheetProps) {
  const { settings, updateSettings, isUpdating } = useKanbanSettings();
  const { t } = useFormsTranslation();

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  const settingsOptions = [
    {
      key: 'kanban_show_project_name' as const,
      label: 'Project Name',
      description: 'Show project names on cards',
    },
    {
      key: 'kanban_show_client_name' as const,
      label: 'Client Name',
      description: 'Show client names on cards',
    },
    {
      key: 'kanban_show_project_type' as const,
      label: 'Project Type',
      description: 'Show project type badges on cards',
    },
    
    {
      key: 'kanban_show_todo_progress' as const,
      label: t("kanban_settings.todo_progress"),
      description: t("kanban_settings.todo_progress_description"),
    },
    {
      key: 'kanban_show_session_count' as const,
      label: 'Session Count',
      description: 'Show session count icons on cards',
    },
    {
      key: 'kanban_show_service_count' as const,
      label: 'Service Count',
      description: 'Show service count icons on cards',
    },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Kanban Card Settings
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          <p className="text-sm text-muted-foreground mb-4">
            Customize what information appears on your project cards. Perfect for solo photographers who want a cleaner view.
          </p>

          <div className="space-y-4">
            {settingsOptions.map((option) => (
              <div key={option.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label 
                      htmlFor={option.key}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <Switch
                    id={option.key}
                    checked={settings[option.key]}
                    onCheckedChange={() => handleToggle(option.key)}
                    disabled={isUpdating}
                  />
                </div>
                {settingsOptions.findIndex(opt => opt.key === option.key) !== settingsOptions.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium">Pro Tip</p>
                <p className="text-xs text-muted-foreground">
                  Customize your project cards to show exactly what you need for managing your photography business efficiently.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}