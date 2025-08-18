import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { signInSchema, signUpSchema, sanitizeInput } from "@/lib/validation";
import { ZodError } from "zod";
import newbornBg from "@/assets/newborn-bg.jpg";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const awaitingConfirmation = searchParams.get("awaiting_confirmation") === "true";
  const invitationFromParams = searchParams.get("invitation");

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // If user is confirmed and has invitation, complete the process
        if (awaitingConfirmation && invitationFromParams) {
          await completeInvitationAfterConfirmation(session.user.id);
        } else {
          navigate("/");
        }
      } else {
        // Handle invitation parameters
        const mode = searchParams.get('mode');
        const invitation = searchParams.get('invitation');
        const inviteEmail = searchParams.get('email');
        
        if (mode === 'signup' && invitation) {
          setInvitationId(invitation);
          if (inviteEmail) {
            setEmail(decodeURIComponent(inviteEmail));
          }
        }
      }
    };
    
    checkSession();
  }, [navigate, awaitingConfirmation, invitationFromParams, searchParams]);

  const completeInvitationAfterConfirmation = async (userId: string) => {
    try {
      // Get invitation details
      const { data: invitation } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", invitationFromParams)
        .single();

      if (!invitation) return;

      // Accept the invitation
      await supabase
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitationFromParams);

      // Add user to organization
      await supabase
        .from("organization_members")
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          invited_by: invitation.invited_by
        });

      toast({
        title: "Welcome to the team!",
        description: "Your email has been confirmed and you've joined the organization!",
      });

      navigate("/");
    } catch (error) {
      console.error("Failed to complete invitation:", error);
      navigate("/");
    }
  };

  const validateForm = (isSignUp: boolean = false) => {
    setEmailError("");
    setPasswordError("");
    
    try {
      const schema = isSignUp ? signUpSchema : signInSchema;
      schema.parse({
        email: sanitizeInput(email),
        password: sanitizeInput(password)
      });
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        error.issues.forEach((err) => {
          if (err.path[0] === "email") {
            setEmailError(err.message);
          } else if (err.path[0] === "password") {
            setPasswordError(err.message);
          }
        });
      }
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(true)) return;
    
    setLoading(true);

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: sanitizeInput(email),
      password: sanitizeInput(password),
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link to complete your registration."
      });
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(false)) return;
    
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: sanitizeInput(email),
      password: sanitizeInput(password)
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    } else {
      // Force a page reload to ensure proper session initialization
      window.location.href = "/";
    }
  };

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
      {/* Soft overlay for better text readability */}
      <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm"></div>
      
      {/* Gradient overlay for extra softness */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-blue-50/60 dark:from-pink-950/60 dark:via-purple-950/40 dark:to-blue-950/60"></div>
      
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Main Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent font-serif">
            Sweet Dreams CRM
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 font-light">
            Where precious moments become lasting memories
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Professional newborn photography management
          </p>
        </div>

        {/* Auth Card */}
        <Card className="backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-white/20 shadow-2xl shadow-pink-200/50 dark:shadow-purple-900/50 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-slate-200">
              {awaitingConfirmation ? "Check Your Email" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {awaitingConfirmation 
                ? "Please check your email and click the confirmation link to complete your account setup" 
                : "Access your photography dashboard"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100/70 dark:bg-slate-700/70">
                <TabsTrigger 
                  value="signin" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div>
                    <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      required
                      className="mt-1 bg-white/70 dark:bg-slate-800/70 border-slate-200/50 focus:border-pink-300 focus:ring-pink-200 rounded-xl h-12"
                      placeholder="your@email.com"
                    />
                    {emailError && <p className="text-sm text-red-500 mt-1 font-medium">{emailError}</p>}
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
                      className="mt-1 bg-white/70 dark:bg-slate-800/70 border-slate-200/50 focus:border-pink-300 focus:ring-pink-200 rounded-xl h-12"
                      placeholder="••••••••"
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
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Signing you in...
                      </div>
                    ) : (
                      "Get Started"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div>
                    <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      required
                      className="mt-1 bg-white/70 dark:bg-slate-800/70 border-slate-200/50 focus:border-pink-300 focus:ring-pink-200 rounded-xl h-12"
                      placeholder="your@email.com"
                    />
                    {emailError && <p className="text-sm text-red-500 mt-1 font-medium">{emailError}</p>}
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
                      placeholder="At least 8 characters"
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
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Creating account...
                      </div>
                     ) : (
                       "Join Sweet Dreams"
                     )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
          <p>Trusted by photographers worldwide</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;