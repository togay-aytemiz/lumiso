import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface OrgItem {
  id: string;
  name: string;
}

export function OrganizationSwitcher({ className }: { className?: string }) {
  const { activeOrganizationId, setActiveOrganization } = useOrganization();
  const { refreshPermissions } = usePermissions();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get active memberships for current user
        const { data: memberships, error } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active');
        if (error) throw error;

        const ids = (memberships || []).map(m => m.organization_id);
        if (ids.length === 0) {
          setOrgs([]);
          return;
        }

        const { data: organizations, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', ids);
        if (orgErr) throw orgErr;

        setOrgs(organizations || []);
      } catch (e) {
        console.error('Failed to load organizations for switcher', e);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgs();
  }, []);

  const handleChange = async (orgId: string) => {
    if (!orgId || orgId === activeOrganizationId) return;
    await setActiveOrganization(orgId);
    await refreshPermissions();
  };

  if (orgs.length <= 1) return null; // No need to show switcher if only one org

  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1 block">Organization</Label>
      <Select value={activeOrganizationId ?? undefined} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {orgs.map(org => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default OrganizationSwitcher;
