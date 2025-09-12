import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Mail, Shield, Clock, Users } from 'lucide-react';
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
  const [inviteRole, setInviteRole] = useState('Member');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [expirationDays, setExpirationDays] = useState(7);
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
      const result = await onSendInvitation(inviteEmail, inviteRole, {
        sendWelcomeEmail,
        expirationDays
      });
      
      if (result.success) {
        setInviteEmail('');
        setInviteRole('Member');
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
  }, [inviteEmail, inviteRole, sendWelcomeEmail, expirationDays, onSendInvitation, toast, validateEmail, checkExistingInvitation]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Invite Team Member
        </CardTitle>
        <CardDescription>
          Send an invitation to add a new member to your team
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
                  {availableRoles.filter(role => role !== "Owner").map(role => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send Welcome Email
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send an introductory email with team information
                </p>
              </div>
              <Switch
                checked={sendWelcomeEmail}
                onCheckedChange={setSendWelcomeEmail}
                disabled={isSubmitting || loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Invitation Expires In
              </Label>
              <Select 
                value={expirationDays.toString()} 
                onValueChange={(value) => setExpirationDays(parseInt(value))}
                disabled={isSubmitting || loading}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Role: {inviteRole}
              </Badge>
              <Badge variant="outline">
                Expires: {expirationDays} days
              </Badge>
            </div>
            
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