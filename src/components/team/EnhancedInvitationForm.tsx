import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, Shield, Users } from 'lucide-react';
import { useInvitationRecovery } from '@/hooks/useInvitationRecovery';

interface EnhancedInvitationFormProps {
  availableRoles: string[];
  onSendInvitation: (email: string, role: string, options?: {
    sendWelcomeEmail?: boolean;
    expirationDays?: number;
  }) => Promise<{ success: boolean; error?: string; }>;
  loading?: boolean;
}

export function EnhancedInvitationForm({ 
  availableRoles, 
  onSendInvitation, 
  loading = false 
}: EnhancedInvitationFormProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Photographer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { validateEmail, checkExistingInvitation } = useInvitationRecovery();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    if (!validateEmail(inviteEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    // Check for existing invitation
    const existingInvitation = await checkExistingInvitation(inviteEmail);
    if (existingInvitation) {
      toast({
        title: "Invitation already exists",
        description: `${inviteEmail} already has a pending invitation`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Always send welcome email and use 7-day expiry (handled by edge function)
      const result = await onSendInvitation(inviteEmail, inviteRole);
      
      if (result.success) {
        setInviteEmail('');
        setInviteRole('Photographer');
        toast({
          title: "Invitation sent!",
          description: `Successfully sent invitation to ${inviteEmail}`,
        });
      } else {
        toast({
          title: "Failed to send invitation",
          description: result.error || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Invitation error:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [inviteEmail, inviteRole, onSendInvitation, toast, validateEmail, checkExistingInvitation]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Invite Team Member
        </CardTitle>
        <CardDescription>
          Send an invitation to add a new member to your team (expires in 7 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isSubmitting || loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invite-role" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role
              </Label>
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={isSubmitting || loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.filter(role => role !== "Owner" && role !== "Member").map(role => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Badge variant="secondary">
              Role: {inviteRole}
            </Badge>
            
            <Button 
              type="submit" 
              disabled={!inviteEmail.trim() || isSubmitting || loading}
              className="min-w-32"
            >
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}