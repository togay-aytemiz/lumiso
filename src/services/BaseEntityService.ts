import { supabase } from '@/integrations/supabase/client';
import { getUserOrganizationId } from '@/lib/organizationUtils';

/**
 * Base service class for entity operations with common patterns
 */
export class BaseEntityService {
  /**
   * Get the current user's organization ID
   */
  protected async getOrganizationId(): Promise<string | null> {
    try {
      return await getUserOrganizationId();
    } catch (error) {
      console.error('Error getting organization ID:', error);
      return null;
    }
  }

  /**
   * Get authenticated user
   */
  protected async getAuthenticatedUser() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('No authenticated user');
    return user.user;
  }
}