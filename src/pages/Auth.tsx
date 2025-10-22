import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { useI18nToast } from "@/lib/toastHelpers";
import { useTranslation } from "react-i18next";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [prevFeatureIndex, setPrevFeatureIndex] = useState<number | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t: tForm } = useFormsTranslation();
  const { t: tMsg } = useMessagesTranslation();
  const { t: tPages } = useTranslation('pages');
  const { t: tCommon } = useTranslation('common');
  const toast = useI18nToast();

  // Password strength helpers (sign-up only UI)
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;
    const percent = Math.min(100, Math.round((score / 6) * 100));
    let color = "bg-red-500";
    let label: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    if (percent >= 66) { color = 'bg-emerald-500'; label = 'strong'; }
    else if (percent >= 50) { color = 'bg-yellow-500'; label = 'good'; }
    else if (percent >= 33) { color = 'bg-orange-500'; label = 'fair'; }
    return { percent, color, label };
  };
  const pwdStrength = getPasswordStrength(password);
  const resetPwdStrength = getPasswordStrength(newPassword);

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
      title: tPages('auth.features.0.title', 'Streamline every client interaction'),
      description: tPages(
        'auth.features.0.description',
        'Centralize your communication, notes, and deal status in one intuitive workspace designed for modern agencies.'
      ),
    },
    {
      title: tPages('auth.features.1.title', 'Forecast revenue with confidence'),
      description: tPages(
        'auth.features.1.description',
        "Track conversion insights, build predictable pipelines, and unlock powerful reporting without leaving Lumiso."
      ),
    },
    {
      title: tPages('auth.features.2.title', 'Automate onboarding with ease'),
      description: tPages(
        'auth.features.2.description',
        'Launch tailored workflows, automate reminders, and deliver delightful client experiences from day one.'
      ),
    },
  ];

  // Animate progress for feature slides and auto-advance
  useEffect(() => {
    const SLIDE_DURATION = 7000; // At least 5s per image
    const start = Date.now();
    setProgress(0);

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(interval);
        setPrevFeatureIndex(activeFeatureIndex);
        setActiveFeatureIndex((prev) => (prev + 1) % featureSlides.length);
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [activeFeatureIndex, featureSlides.length]);

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

  const handlePasswordResetRequest = async () => {
    if (!email) {
      toast.error(tMsg('auth.reset_email_missing'));
      return;
    }

    setResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });

      if (error) throw error;

      toast.success(tMsg('auth.reset_email_sent'));
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error(error.message || tMsg('auth.reset_email_error'));
    } finally {
      setResettingPassword(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error(tMsg('auth.password_too_short'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(tMsg('auth.password_mismatch'));
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success(tMsg('auth.password_updated'));
      setIsPasswordResetMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setTimeout(() => navigate("/"), 1000);
    } catch (error: any) {
      console.error("Password update error:", error);
      toast.error(error.message || tMsg('auth.password_update_error'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    if (hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery") {
      setIsSignUp(false);
      setIsPasswordResetMode(true);
      setShowPassword(false);
    }
  }, []);

  const authLabel = isPasswordResetMode
    ? tForm('auth.password_reset.title')
    : isSignUp
    ? tForm('auth.sign_up.title')
    : tForm('auth.sign_in.title');

  const welcomeText = isPasswordResetMode
    ? tPages('auth.welcome.recovery', 'Reset your password 🔐')
    : isSignUp
    ? tPages('auth.welcome.signUp', "Let's get started 🚀")
    : tPages('auth.welcome.signIn', 'Welcome back 👋🏻');

  const copyText = isPasswordResetMode
    ? tPages('auth.copy.recovery', 'Set a new password to regain access to your workspace.')
    : isSignUp
    ? tPages('auth.copy.signUp', 'Create your Lumiso account to unlock collaborative workflows and beautiful client experiences.')
    : tPages('auth.copy.signIn', 'Sign in with your credentials to pick up exactly where your team left off.');

  return (
    <div className="flex min-h-screen w-full bg-white">
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden lg:flex-row">
        <div className="relative flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2 lg:px-12">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/10 via-white to-transparent" aria-hidden="true" />

          {/* Logo pinned to top-left */}
          <div className="absolute left-6 top-6 sm:left-10">
            <img src="/lumiso-logo.png" alt={tCommon('branding.app_name', 'Lumiso')} className="h-10 w-auto" loading="eager" />
          </div>

          {/* Centered form area */}
          <div className="flex flex-1 items-center pt-24 sm:pt-16 lg:pt-0">
            <div key={isPasswordResetMode ? 'reset' : isSignUp ? 'signup' : 'signin'} className="relative mx-auto w-full max-w-md fade-in-up">
              <div className="mb-8 space-y-3">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  {authLabel}
                </div>
                <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  {welcomeText}
                </h1>
                <p className="text-base text-slate-500">{copyText}</p>
              </div>

              {isPasswordResetMode ? (
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                  <p className="text-sm text-slate-500">{tForm('auth.password_reset.instructions')}</p>
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium text-slate-600">
                      {tForm('labels.password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={tForm('placeholders.enter_password')}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        disabled={updatingPassword}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/60 px-4 pr-12 text-base shadow-inner transition focus:border-primary/60 focus:bg-white focus:ring-2 focus:ring-primary/20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-1 my-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={updatingPassword}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                    <div className="mt-2">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={resetPwdStrength.percent}
                        aria-label={tForm('password_tips.strength', 'Password strength')}
                      >
                        <div
                          className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${resetPwdStrength.color}`}
                          style={{ width: `${resetPwdStrength.percent}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                        <span>{tForm('password_tips.strength', 'Password strength')}</span>
                        <span>
                          {resetPwdStrength.label === 'weak' && tForm('password_tips.weak', 'Weak')}
                          {resetPwdStrength.label === 'fair' && tForm('password_tips.fair', 'Fair')}
                          {resetPwdStrength.label === 'good' && tForm('password_tips.good', 'Good')}
                          {resetPwdStrength.label === 'strong' && tForm('password_tips.strong', 'Strong')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-600">
                      {tForm('labels.confirm_password')}
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder={tForm('placeholders.confirm_password')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={updatingPassword}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50/60 px-4 text-base shadow-inner transition focus:border-primary/60 focus:bg-white focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="group flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    disabled={updatingPassword}
                  >
                    {updatingPassword ? `${tMsg('info.loading')}...` : tForm('auth.password_reset.button')}
                  </Button>
                </form>
              ) : (
                <>
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
                      {!isSignUp && (
                        <div className="flex justify-end pt-1">
                          <Button
                            type="button"
                            variant="link"
                            onClick={handlePasswordResetRequest}
                            disabled={loading || resettingPassword}
                            className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            {resettingPassword ? tForm('auth.sign_in.sending_link') : tForm('auth.sign_in.forgot_password')}
                          </Button>
                        </div>
                      )}
                      {isSignUp && (
                        <div className="mt-2">
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pwdStrength.percent}
                            aria-label={tForm('password_tips.strength', 'Password strength')}
                          >
                            <div
                              className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${pwdStrength.color}`}
                              style={{ width: `${pwdStrength.percent}%` }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                            <span>{tForm('password_tips.strength', 'Password strength')}</span>
                            <span>
                              {pwdStrength.label === 'weak' && tForm('password_tips.weak', 'Weak')}
                              {pwdStrength.label === 'fair' && tForm('password_tips.fair', 'Fair')}
                              {pwdStrength.label === 'good' && tForm('password_tips.good', 'Good')}
                              {pwdStrength.label === 'strong' && tForm('password_tips.strong', 'Strong')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Password recommendations (optional, sign-up only) */}
                    {isSignUp && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-medium text-slate-500">{tForm('password_tips.title', 'For a stronger password')}</p>
                        <div className="grid grid-cols-1 gap-1 text-xs text-slate-500">
                          {[
                            { key: 'length', label: tForm('password_tips.eight_chars', 'At least 8 characters'), valid: password.length >= 8 },
                            { key: 'uppercase', label: tForm('password_tips.uppercase', 'At least 1 uppercase letter'), valid: /[A-Z]/.test(password) },
                            { key: 'special', label: tForm('password_tips.special', 'At least 1 special character'), valid: /[^A-Za-z0-9]/.test(password) },
                          ].map((item) => (
                            <div key={item.key} className="flex items-center gap-2">
                              {item.valid ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-slate-300" />
                              )}
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">{tForm('password_tips.optional', 'Optional recommendations, not required')}</p>
                      </div>
                    )}
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
                    <span>
                      {isSignUp
                        ? tPages('auth.toggle.existingAccount', 'Already have an account?')
                        : tPages('auth.toggle.newToBrand', { brand: tCommon('branding.app_name', 'Lumiso') })}
                    </span>
                    <Button
                      variant="link"
                      onClick={() => setIsSignUp(!isSignUp)}
                      disabled={loading}
                      className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
                    >
                      {isSignUp ? tForm('auth.sign_in.button') : tForm('auth.sign_up.button')}
                    </Button>
                  </div>
                </>
              )}
              {isPasswordResetMode && (
                <div className="mt-8 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsPasswordResetMode(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setShowPassword(false);
                    }}
                    disabled={updatingPassword}
                    className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
                  >
                    {tForm('auth.password_reset.back_to_sign_in')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-6 left-6 hidden text-xs text-slate-400 sm:flex">
            <span>© {new Date().getFullYear()} {tCommon('branding.app_name', 'Lumiso')}. {tCommon('legal.all_rights_reserved', 'All rights reserved.')}</span>
          </div>
        </div>

        <div className="relative hidden min-h-full flex-1 flex-col justify-between overflow-hidden bg-slate-900 text-white lg:flex">
          {/* Aurora gradient background with floating blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -inset-24 opacity-80 blur-3xl aurora-bg" />
            <div className="absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl float-slow" />
            <div className="absolute top-16 right-10 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl float-slow [animation-delay:1.2s]" />
            <div className="absolute -top-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-400/15 blur-3xl float-slow [animation-delay:2.4s]" />
          </div>

          <div className="relative flex flex-1 flex-col px-12 py-14">
            <div className="mb-12 flex flex-col gap-3">
              <span className="w-fit rounded-full bg-white/15 px-4 py-1 text-sm font-medium text-white/85 backdrop-blur">
                {tPages('auth.platformHighlights', 'Platform highlights')}
              </span>
              <div className="relative h-[96px] max-w-xl">
                {featureSlides.map((slide, index) => (
                  <div
                    key={`title-${index}`}
                    className={`absolute inset-0 transition-all duration-700 ${
                      index === activeFeatureIndex
                        ? 'opacity-100 translate-y-0'
                        : 'pointer-events-none opacity-0 translate-y-3'
                    }`}
                  >
                    <h2 className="text-3xl font-semibold leading-tight fade-in-up">
                      {slide.title}
                    </h2>
                    <p className="mt-2 max-w-xl text-base text-white/80">
                      {slide.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-auto flex flex-1 items-center">
              <div key={activeFeatureIndex} className="relative w-full transition-transform duration-700 will-change-transform fade-in-up">
                <img
                  src="/placeholder.svg"
                  alt="Showcase placeholder"
                  className="h-[520px] w-full rounded-[28px] object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-between px-12 pb-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPrevFeatureIndex(activeFeatureIndex);
                  setActiveFeatureIndex((prev) => (prev - 1 + featureSlides.length) % featureSlides.length);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition"
                aria-label={tPages('auth.controls.prev', 'Previous feature')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {featureSlides.map((_, index) => {
                const segmentPct = index < activeFeatureIndex ? 100 : index === activeFeatureIndex ? progress : 0;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setPrevFeatureIndex(activeFeatureIndex);
                      setActiveFeatureIndex(index);
                    }}
                    className="group relative h-2 w-24 overflow-hidden rounded-full bg-white/25"
                    aria-label={tPages('auth.controls.showFeature', { index: index + 1, defaultValue: `Show feature ${index + 1}` }) as string}
                  >
                    <span
                      className="absolute left-0 top-0 h-full bg-white transition-[width] duration-100 ease-linear"
                      style={{ width: `${segmentPct}%` }}
                    />
                    <span className="sr-only">{tPages('auth.controls.progress', { index: index + 1, defaultValue: `Progress for feature ${index + 1}` }) as string}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setPrevFeatureIndex(activeFeatureIndex);
                  setActiveFeatureIndex((prev) => (prev + 1) % featureSlides.length);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition"
                aria-label={tPages('auth.controls.next', 'Next feature')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm font-medium text-white/80">
              {String(activeFeatureIndex + 1).padStart(2, "0")} / {String(featureSlides.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
