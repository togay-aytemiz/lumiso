import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionDenied } from "@/components/PermissionDenied";

interface ProtectedFeatureProps {
  requiredPermissions: string[];
  fallback?: ReactNode;
  title?: string;
  description?: string;
  children: ReactNode;
}

export function ProtectedFeature({ 
  requiredPermissions, 
  fallback, 
  title,
  description,
  children 
}: ProtectedFeatureProps) {
  const { hasAnyPermission, loading } = usePermissions();

  // While loading permissions, avoid flashing protected content
  if (loading) {
    return null;
  }

  // Check if user has any of the required permissions
  const hasPermission = hasAnyPermission(requiredPermissions);

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <PermissionDenied 
        title={title || "Feature Access Denied"}
        description={description || "You don't have permission to access this feature."}
        requiredPermission={requiredPermissions.join(" or ")}
      />
    );
  }

  return <>{children}</>;
}