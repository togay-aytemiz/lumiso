import { PageHeader } from "@/components/ui/page-header";

export default function AutomationTemplates() {
  return (
    <div className="space-y-6">
      <PageHeader title="Templates" />
      <p className="text-muted-foreground -mt-2">
        Manage your email, SMS, and WhatsApp message templates
      </p>
      
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-muted-foreground">Coming Soon</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Template management for automated communications
          </p>
        </div>
      </div>
    </div>
  );
}