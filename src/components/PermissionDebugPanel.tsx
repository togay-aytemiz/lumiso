import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, RefreshCw, Bug } from 'lucide-react';

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

  const handleRefresh = () => {
    clearCache();
    refetch();
  };

  const criticalPermissions = [
    'manage_all_leads',
    'manage_all_projects',
    'create_leads',
    'create_projects',
    'delete_leads',
    'delete_projects',
    'manage_team',
    'manage_roles',
    'admin'
  ];

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border-primary/20"
          >
            <Bug className="h-4 w-4" />
            Permissions Debug
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="w-80 max-h-96 overflow-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Permission Debug Panel
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Status: {loading ? 'Loading...' : `${permissions.length} permissions loaded`}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Critical Permissions
                </div>
                <div className="flex flex-wrap gap-1">
                  {criticalPermissions.map((permission) => (
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
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  All Permissions ({permissions.length})
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {permissions.length > 0 ? (
                      permissions.map((permission) => (
                        <Badge
                          key={permission}
                          variant="outline"
                          className="text-xs"
                        >
                          {permission}
                        </Badge>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No permissions loaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}