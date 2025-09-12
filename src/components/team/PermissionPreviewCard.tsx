import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Eye, 
  Edit, 
  Plus, 
  Trash2, 
  Settings, 
  Users, 
  FileText,
  Calendar,
  Lock,
  Unlock
} from 'lucide-react';

interface PermissionPreviewCardProps {
  previewData: Array<{
    category: string;
    permissions: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
    }>;
    enabled: boolean;
    description: string;
  }>;
  selectedPermissions: string[];
  onTogglePermission: (permissionId: string) => void;
  onToggleCategory: (category: string) => void;
  getPermissionSummary: () => string;
  getAccessLevel: () => string;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'leads':
      return Users;
    case 'projects':
      return FileText;
    case 'sessions':
      return Calendar;
    case 'settings':
      return Settings;
    case 'team':
      return Shield;
    default:
      return Lock;
  }
};

const getAccessLevelColor = (level: string) => {
  switch (level) {
    case 'no-access':
      return 'destructive';
    case 'low-access':
      return 'secondary';
    case 'medium-access':
      return 'default';
    case 'high-access':
      return 'default';
    case 'full-access':
      return 'default';
    default:
      return 'secondary';
  }
};

const getAccessLevelIcon = (level: string) => {
  switch (level) {
    case 'no-access':
      return Lock;
    case 'full-access':
      return Unlock;
    default:
      return Shield;
  }
};

export function PermissionPreviewCard({
  previewData,
  selectedPermissions,
  onTogglePermission,
  onToggleCategory,
  getPermissionSummary,
  getAccessLevel
}: PermissionPreviewCardProps) {
  const accessLevel = getAccessLevel();
  const AccessLevelIcon = getAccessLevelIcon(accessLevel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Preview
          </span>
          <Badge variant={getAccessLevelColor(accessLevel)} className="flex items-center gap-1">
            <AccessLevelIcon className="h-3 w-3" />
            {accessLevel.replace('-', ' ')}
          </Badge>
        </CardTitle>
        <CardDescription>
          {getPermissionSummary()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {previewData.map((category, index) => {
          const CategoryIcon = getCategoryIcon(category.category);
          const allCategoryEnabled = category.permissions.every(p => 
            selectedPermissions.includes(p.id)
          );
          
          return (
            <div key={category.category}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4" />
                  <span className="font-medium capitalize">{category.category}</span>
                  <Badge variant="outline" className="text-xs">
                    {category.permissions.filter(p => selectedPermissions.includes(p.id)).length}/{category.permissions.length}
                  </Badge>
                </div>
                <Switch
                  checked={allCategoryEnabled}
                  onCheckedChange={() => onToggleCategory(category.category)}
                />
              </div>
              
              <div className="space-y-2 ml-6">
                {category.permissions.map((permission) => {
                  const isEnabled = selectedPermissions.includes(permission.id);
                  
                  return (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {permission.name.replace('_', ' ')}
                          </span>
                          {isEnabled && (
                            <Badge variant="secondary" className="text-xs">
                              enabled
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {permission.description}
                        </p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => onTogglePermission(permission.id)}
                      />
                    </div>
                  );
                })}
              </div>
              
              {index < previewData.length - 1 && <Separator className="mt-4" />}
            </div>
          );
        })}
        
        {previewData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No permissions available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}