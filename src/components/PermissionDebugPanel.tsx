import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

interface PermissionDebugPanelProps {
  className?: string;
}

export function PermissionDebugPanel({ className }: PermissionDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { permissions, loading, hasPermission, refetch, clearCache } = usePermissions();
  
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleRefresh = async () => {
    clearCache();
    await refetch();
  };

  const criticalPermissions = [
    'view_organization_settings',
    'manage_organization_settings', 
    'view_packages',
    'manage_packages',
    'view_services', 
    'manage_services',
    'view_workflows',
    'manage_workflows',
    'view_assigned_leads',
    'manage_all_leads',
    'view_assigned_projects',
    'manage_all_projects'
  ];

  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="mb-2 bg-background/95 backdrop-blur-sm border shadow-lg"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Permission Debug
            {loading && <RefreshCw className="h-3 w-3 ml-2 animate-spin" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-4 shadow-lg max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Permissions Debug</h3>
              <Button
                variant="ghost"
                size="sm" 
                onClick={handleRefresh}
                disabled={loading}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">Critical Permissions</h4>
                <div className="flex flex-wrap gap-1">
                  {criticalPermissions.map(permission => (
                    <Badge 
                      key={permission}
                      variant={hasPermission(permission) ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                  All Loaded Permissions ({permissions.length})
                </h4>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {permissions.map(permission => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}