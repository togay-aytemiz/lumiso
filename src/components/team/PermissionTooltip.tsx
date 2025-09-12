import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface PermissionTooltipProps {
  permissions: Permission[];
  count?: number;
}

export function PermissionTooltip({ permissions, count }: PermissionTooltipProps) {
  const permissionCount = count ?? permissions.length;
  
  if (permissionCount === 0) {
    return <span className="text-muted-foreground">0 permissions</span>;
  }

  const formatPermissionName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const sortedPermissions = permissions
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-foreground hover:text-primary transition-colors">
          {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <p className="font-medium text-xs mb-2">Permissions:</p>
          {sortedPermissions.map((permission) => (
            <div key={permission.id} className="text-xs">
              • {formatPermissionName(permission.name)}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}