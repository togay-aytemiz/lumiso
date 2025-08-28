import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Workflows() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader 
        title="Workflows" 
        subtitle="Automate your client communications with smart workflows"
      />
      
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-muted-foreground">Coming Soon</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Automated workflows to streamline your client communications
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}