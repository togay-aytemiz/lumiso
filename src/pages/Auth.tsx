import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { useI18nToast } from "@/lib/toastHelpers";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t: tForm } = useFormsTranslation();
  const { t: tMsg } = useMessagesTranslation();
  const toast = useI18nToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const clearAuthState = () => {
    // Clear all auth related storage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  const featureSlides = [
    {
      title: "Streamline every client interaction",
      description:
        "Centralize your communication, notes, and deal status in one intuitive workspace designed for modern agencies.",
    },
    {
      title: "Forecast revenue with confidence",
      description:
        "Track conversion insights, build predictable pipelines, and unlock powerful reporting without leaving Lumiso.",
    },
    {
      title: "Automate onboarding with ease",
      description:
        "Launch tailored workflows, automate reminders, and deliver delightful client experiences from day one.",
    },
  ];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % featureSlides.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [featureSlides.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Always clear previous state first
      clearAuthState();
      await supabase.auth.signOut({ scope: 'global' });

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (error) throw error;

        if (data.user && !data.user.email_confirmed_at) {
          toast.success(tMsg('auth.email_confirmation'));
          setLoading(false);
        } else if (data.user) {
          toast.success(tMsg('auth.account_created'));
          // Navigate to home
          setTimeout(() => navigate("/"), 1000);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        console.log("Sign in successful:", data.user?.id);
        toast.success(tMsg('auth.signed_in'));
        
        // Navigate to home
        setTimeout(() => navigate("/"), 1000);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || tMsg('auth.auth_error'));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-slate-100 lg:flex-row">
        <div className="relative flex w-full flex-col justify-between px-8 py-12 sm:px-12 lg:w-[52%] lg:px-16">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-primary/10 via-white to-transparent" aria-hidden="true" />

          <div className="relative flex items-center gap-3 pb-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary shadow-sm">
              L
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Welcome to</p>
              <p className="text-xl font-semibold text-slate-900">Lumiso</p>
            </div>
          </div>

          <div className="relative">
            <div className="mb-10 space-y-4">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                {isSignUp ? tForm('auth.sign_up.title') : tForm('auth.sign_in.title')}
              </div>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {isSignUp ? tForm('auth.sign_up.subtitle') : tForm('auth.sign_in.subtitle')}
              </h1>
              <p className="text-base text-slate-500">
                {isSignUp
                  ? "Create your Lumiso account to unlock collaborative workflows and beautiful client experiences."
                  : "Sign in with your credentials to pick up exactly where your team left off."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-600">
                  {tForm('labels.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={tForm('placeholders.enter_email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/60 px-4 text-base shadow-inner transition focus:border-primary/60 focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-600">
                  {tForm('labels.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={tForm('placeholders.enter_password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50/60 px-4 pr-12 text-base shadow-inner transition focus:border-primary/60 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-1 my-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                className="group flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                disabled={loading}
              >
                {loading
                  ? `${tMsg('info.loading')}...`
                  : isSignUp
                  ? tForm('auth.sign_up.button')
                  : tForm('auth.sign_in.button')}
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
              <span>{isSignUp ? "Already have an account?" : "New to Lumiso?"}</span>
              <Button
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
                disabled={loading}
                className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
              >
                {isSignUp ? tForm('auth.sign_in.link') : tForm('auth.sign_up.link')}
              </Button>
            </div>
          </div>

          <div className="relative mt-16 hidden text-xs text-slate-400 sm:flex">
            <span>© {new Date().getFullYear()} Lumiso. All rights reserved.</span>
          </div>
        </div>

        <div className="relative hidden min-h-full flex-1 flex-col justify-between overflow-hidden bg-slate-900 text-white lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(30,178,159,0.45),_transparent_60%)]" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,0.2),transparent)]" aria-hidden="true" />

          <div className="relative flex flex-1 flex-col px-12 py-14">
            <div className="mb-12 flex flex-col gap-3">
              <span className="w-fit rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-white/80 backdrop-blur">
                Platform highlights
              </span>
              <h2 className="text-3xl font-semibold leading-tight">{featureSlides[activeFeatureIndex].title}</h2>
              <p className="max-w-sm text-base text-white/70">
                {featureSlides[activeFeatureIndex].description}
              </p>
            </div>

            <div className="relative mt-auto flex flex-1 items-center justify-center">
              <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-[0_40px_80px_-40px_rgba(15,118,110,0.45)] backdrop-blur">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/20" />
                  <div>
                    <p className="text-sm font-semibold text-white/90">Feature preview</p>
                    <p className="text-xs text-white/60">Replace with your product imagery</p>
                  </div>
                </div>
                <div className="h-48 w-full rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-white/10" />
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-between px-12 pb-10">
            <div className="flex gap-2">
              {featureSlides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveFeatureIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === activeFeatureIndex ? "w-10 bg-white" : "w-6 bg-white/40 hover:bg-white/60"
                  }`}
                  aria-label={`Show feature ${index + 1}`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-white/70">
              {String(activeFeatureIndex + 1).padStart(2, "0")} / {String(featureSlides.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;