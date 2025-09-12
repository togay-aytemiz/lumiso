import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrganization } from "@/contexts/OrganizationContext";
import { PermissionDenied } from "@/components/PermissionDenied";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedPageProps {
  requiredPermissions?: string[];
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  description?: string;
}

export function ProtectedPage({ 
  requiredPermissions = [], 
  children, 
  fallback,
  title,
  description
}: ProtectedPageProps) {
  const { hasAnyPermission, loading: permissionsLoading } = usePermissions();
  const { loading: orgLoading } = useOrganization();

  // Show skeleton while loading organization or permissions
  if (orgLoading || permissionsLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 w-full space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // If no permissions required, just render children
  if (requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  // Check permissions
  const hasPermission = hasAnyPermission(requiredPermissions);

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <PermissionDenied 
        title={title || "Page Access Denied"}
        description={description || "You don't have permission to access this page."}
        requiredPermission={requiredPermissions.join(" or ")}
      />
    );
  }

  return <>{children}</>;
}