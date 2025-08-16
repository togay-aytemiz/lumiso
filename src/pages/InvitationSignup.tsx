import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signUpSchema, sanitizeInput } from "@/lib/validation";
import { ZodError } from "zod";
import newbornBg from "@/assets/newborn-bg.jpg";

export default function InvitationSignup() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [invitation, setInvitation] = useState<any>(null);
  const [invitationError, setInvitationError] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const invitationId = searchParams.get("invitation");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!invitationId || !email) {
      setInvitationError("Invalid invitation link");
      return;
    }

    fetchInvitation();
  }, [invitationId, email]);

  const fetchInvitation = async () => {
    if (!invitationId) return;
    
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", invitationId)
        .single();

      if (error) {
        setInvitationError("Invitation not found");
        return;
      }

      // Check if invitation is expired
      if (new Date(data.expires_at) < new Date()) {
        setInvitationError("This invitation has expired");
        return;
      }

      // Check if already accepted
      if (data.accepted_at) {
        setInvitationError("This invitation has already been accepted");
        return;
      }

      // Check if email matches
      const inviteEmail = decodeURIComponent(email || "");
      if (data.email !== inviteEmail) {
        console.log("Email mismatch:", { invitationEmail: data.email, urlEmail: inviteEmail });
        setInvitationError("Email mismatch with invitation");
        return;
      }

      setInvitation(data);
    } catch (error) {
      setInvitationError("Failed to load invitation");
    }
  };

  const validatePassword = () => {
    setPasswordError("");
    
    const inviteEmail = decodeURIComponent(email || "");
    console.log("Validating with email:", inviteEmail);
    
    try {
      signUpSchema.parse({
        email: inviteEmail,
        password: sanitizeInput(password)
      });
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const passwordIssue = error.issues.find(issue => issue.path[0] === "password");
        if (passwordIssue) {
          setPasswordError(passwordIssue.message);
        }
      }
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword() || !invitation) return;
    
    setLoading(true);

    try {
      const inviteEmail = decodeURIComponent(email || "");
      console.log("Creating account with email:", inviteEmail);
      
      // Create the account with email confirmation disabled for invitations
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: sanitizeInput(inviteEmail),
        password: sanitizeInput(password),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            invited: true, // Mark as invited user
            invitation_id: invitationId
          }
        }
      });

      if (authError) {
        console.error("Auth error:", authError);
        toast({
          title: "Account creation failed",
          description: `${authError.message}. Please check if the email address is valid.`,
          variant: "destructive"
        });
        return;
      }

      if (!authData.user) {
        toast({
          title: "Account creation failed",
          description: "Failed to create user account",
          variant: "destructive"
        });
        return;
      }

      // For invited users, we need to check if email confirmation is required
      if (!authData.user.email_confirmed_at) {
        // Show confirmation message and redirect to a waiting page
        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link. Please check your email and click the link to complete your account setup.",
        });
        
        // Redirect to a confirmation waiting page
        navigate(`/auth?email=${encodeURIComponent(inviteEmail)}&invitation=${invitationId}&awaiting_confirmation=true`);
        return;
      }

      // User is confirmed, proceed with invitation acceptance
      await completeInvitationProcess(authData.user.id);

    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const completeInvitationProcess = async (userId: string) => {
    try {
      // Accept the invitation
      const { error: acceptError } = await supabase
        .from("invitations")
        .update({ 
          accepted_at: new Date().toISOString()
        })
        .eq("id", invitationId);

      if (acceptError) {
        console.error("Failed to accept invitation:", acceptError);
      }

      // Add user to organization
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          invited_by: invitation.invited_by
        });

      if (memberError) {
        console.error("Failed to join organization:", memberError);
      }

      setSuccess(true);
      
      toast({
        title: "Welcome to the team!",
        description: "Your account has been created and you've joined the organization successfully!",
      });

      // Redirect after a moment
      setTimeout(() => {
        navigate("/");
      }, 2000);

    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (invitationError) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${newbornBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
        
        <div className="relative z-10 w-full max-w-md mx-4">
          <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
              <CardDescription>{invitationError}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate("/auth")} variant="outline">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${newbornBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
        
        <div className="relative z-10 w-full max-w-md mx-4">
          <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl">
            <CardHeader className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-green-600">Welcome to the Team!</CardTitle>
              <CardDescription>
                Your account has been created and you've successfully joined the organization. 
                Redirecting to dashboard...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: `url(${newbornBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
        
        <div className="relative z-10 w-full max-w-md mx-4">
          <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl">
            <CardHeader className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <CardTitle>Loading Invitation...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${newbornBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
      
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent font-serif">
            Sweet Dreams CRM
          </h1>
          <div className="flex items-center justify-center gap-2 text-lg text-slate-600 dark:text-slate-300">
            <Users className="h-5 w-5" />
            <span>Team Invitation</span>
          </div>
        </div>

        {/* Invitation Card */}
        <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl mb-6">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
              You're Invited to Join
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              You've been invited as a <strong>{invitation.role}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
              <p className="font-medium">{email ? decodeURIComponent(email) : ""}</p>
            </div>
            <p className="text-xs text-slate-500">
              Expires: {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        {/* Signup Form */}
        <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
              Create Your Account
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Set up your password to complete the invitation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email ? decodeURIComponent(email) : ""}
                  disabled
                  className="mt-1 bg-slate-100 dark:bg-slate-700 border-slate-200/50 rounded-xl h-12"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                  required
                  minLength={8}
                  className="mt-1 bg-white/70 dark:bg-slate-800/70 border-slate-200/50 focus:border-pink-300 focus:ring-pink-200 rounded-xl h-12"
                  placeholder="Create a secure password (min 8 characters)"
                />
                {passwordError && <p className="text-sm text-red-500 mt-1 font-medium">{passwordError}</p>}
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating your account...
                  </div>
                ) : (
                  "Create Account & Join Team"
                )}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
                className="text-slate-500 hover:text-slate-700"
              >
                Already have an account? Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}