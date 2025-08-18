import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Clock, Mail } from "lucide-react";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<'loading' | 'success' | 'error' | 'expired' | 'already_accepted' | 'invalid'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const invitationId = searchParams.get('invitation_id');

  const acceptInvitation = async () => {
    if (!invitationId) {
      setState('invalid');
      setErrorMessage('No invitation ID provided');
      return;
    }

    console.log('Starting invitation acceptance for ID:', invitationId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session found, redirecting to auth');
        // Redirect to auth with return URL
        const returnUrl = `/accept-invite?invitation_id=${invitationId}`;
        navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      console.log('Session found, calling accept-invitation function with:', {
        invitationId,
        accessToken: session.access_token ? 'present' : 'missing'
      });

      const { data, error } = await supabase.functions.invoke('accept-invitation', {
        body: { invitationId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error from supabase.functions.invoke:', error);
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          cause: error.cause
        });
        
        if (error.message?.includes('expired')) {
          setState('expired');
        } else if (error.message?.includes('already')) {
          setState('already_accepted');
        } else {
          setState('error');
          setErrorMessage(error.message || 'Failed to accept invitation');
        }
        return;
      }

      console.log('Response from accept-invitation:', data);

      if (data?.error) {
        console.error('Error in response data:', data.error);
        if (data.error.includes('expired')) {
          setState('expired');
        } else if (data.error.includes('already')) {
          setState('already_accepted');
        } else {
          setState('error');
          setErrorMessage(data.error);
        }
        return;
      }

      console.log('Invitation accepted successfully:', data);
      setState('success');
      
      toast({
        title: "Welcome!",
        description: "You've successfully joined the organization.",
      });

      // Navigate to home after a brief delay
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setState('error');
      setErrorMessage(error.message || 'An unexpected error occurred');
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Redirect to auth with return URL
        const returnUrl = `/accept-invite?invitation_id=${invitationId}`;
        navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`);
      } else {
        acceptInvitation();
      }
    }
  }, [user, authLoading, invitationId]);

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Accepting Invitation</h3>
              <p className="text-muted-foreground">Please wait while we process your invitation...</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-green-700">Welcome to the Team!</h3>
              <p className="text-muted-foreground">You've successfully joined the organization. Redirecting you to the app...</p>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center space-y-4">
            <Clock className="h-12 w-12 mx-auto text-amber-500" />
            <div>
              <h3 className="text-lg font-semibold text-amber-700">Invitation Expired</h3>
              <p className="text-muted-foreground">This invitation has expired. Please contact your team admin for a new invitation.</p>
            </div>
            <Button onClick={() => navigate('/')} variant="outline">
              Go to Home
            </Button>
          </div>
        );

      case 'already_accepted':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-blue-700">Already a Member</h3>
              <p className="text-muted-foreground">You're already a member of this organization or this invitation has been used.</p>
            </div>
            <Button onClick={() => navigate('/')}>
              Go to App
            </Button>
          </div>
        );

      case 'invalid':
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-red-700">Invalid Invitation</h3>
              <p className="text-muted-foreground">This invitation link is invalid or malformed.</p>
            </div>
            <Button onClick={() => navigate('/')} variant="outline">
              Go to Home
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-red-700">Error</h3>
              <p className="text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="space-x-2">
              <Button onClick={acceptInvitation} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => navigate('/')} variant="outline">
                Go to Home
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>
            Join your team and start collaborating
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;