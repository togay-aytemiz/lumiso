import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'admin' | 'support' | 'user';

export function useUserRole() {
  const { userRoles } = useAuth();

  const hasRole = (role: UserRole): boolean => {
    return userRoles.includes(role);
  };

  const isAdmin = (): boolean => {
    return hasRole('admin');
  };

  const isSupport = (): boolean => {
    return hasRole('support');
  };

  const isAdminOrSupport = (): boolean => {
    return isAdmin() || isSupport();
  };

  return {
    userRoles,
    hasRole,
    isAdmin,
    isSupport,
    isAdminOrSupport,
  };
}