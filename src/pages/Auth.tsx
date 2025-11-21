import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthApiError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ChevronLeft, ChevronRight, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { useI18nToast } from "@/lib/toastHelpers";
import { logAuthEvent } from "@/lib/authTelemetry";
import { useTranslation } from "react-i18next";

const normalizeAuthPath = (pathname: string) => {
  const trimmed = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return trimmed.toLowerCase();
};

const getModeFromLocation = (pathname: string, search: string): "signin" | "signup" => {
  const params = new URLSearchParams(search);
  const queryMode = (params.get("view") || params.get("mode") || "").toLowerCase();

  if (queryMode === "signup" || queryMode === "sign-up") return "signup";
  if (queryMode === "signin" || queryMode === "sign-in" || queryMode === "login") return "signin";

  const normalized = normalizeAuthPath(pathname || "");
  if (normalized.endsWith("/auth/signup") || normalized.endsWith("/auth/sign-up")) {
    return "signup";
  }

  return "signin";
};

const AUTH_BYPASS_TYPES = new Set(["recovery", "invite"]);

const getTypeFromSearchOrHash = (search: string, hash: string) => {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    (searchParams.get("type") || "").toLowerCase() ||
    (hashParams.get("type") || "").toLowerCase()
  );
};

const getAuthIntentFromLocation = (pathname: string, search: string, hash: string) => {
  const normalized = normalizeAuthPath(pathname || "");
  if (normalized.endsWith("/auth/recovery")) {
    return "recovery";
  }
  const type = getTypeFromSearchOrHash(search, hash);
  return type || undefined;
};

const shouldBypassRedirect = (intent?: string) => {
  if (!intent) return false;
  return AUTH_BYPASS_TYPES.has(intent);
};

const Auth = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(() => getModeFromLocation(location.pathname, location.search) === "signup");
  const [loading, setLoading] = useState(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
  const [isPasswordResetRequestMode, setIsPasswordResetRequestMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [prevFeatureIndex, setPrevFeatureIndex] = useState<number | null>(null);
  const { t: tForm } = useFormsTranslation();
  const { t: tMsg } = useMessagesTranslation();
  const { t: tPages } = useTranslation('pages');
  const { t: tCommon } = useTranslation('common');
  const toast = useI18nToast();
  const authIntent = getAuthIntentFromLocation(location.pathname, location.search, location.hash || "");
  const recoveryIntentActive = authIntent === "recovery";
  const recordToast = useCallback((toastVariant: "success" | "error", toastMessageKey?: string, toastCopy?: string) => {
    logAuthEvent("auth_toast_triggered", {
      toastVariant,
      toastMessageKey,
      toastCopy,
      email,
    });
  }, [email]);

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
  const getPasswordToggleLabel = (visible: boolean) =>
    visible
      ? tForm("auth.password_visibility.hide", "Hide password")
      : tForm("auth.password_visibility.show", "Show password");

  useEffect(() => {
    const normalizedPath = normalizeAuthPath(location.pathname || "");
    const hasRecoveryPath = normalizedPath.endsWith("/auth/recovery");
    const searchParams = new URLSearchParams(location.search);
    const searchType = (searchParams.get("type") || "").toLowerCase();
    const hashType = new URLSearchParams((location.hash || "").replace(/^#/, "")).get("type")?.toLowerCase();
    const wantsRecovery = searchType === "recovery" || hashType === "recovery";

    if (!hasRecoveryPath && wantsRecovery) {
      if (searchType === "recovery") {
        searchParams.delete("type");
      }
      const nextSearch = searchParams.toString();
      const nextUrl = `/auth/recovery${nextSearch ? `?${nextSearch}` : ""}${location.hash || ""}`;
      navigate(nextUrl, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    const derivedMode = (recoveryIntentActive || isPasswordResetRequestMode)
      ? "signin"
      : getModeFromLocation(location.pathname, location.search);
    const shouldSignUp = derivedMode === "signup";

    setIsSignUp((prev) => (prev === shouldSignUp ? prev : shouldSignUp));
  }, [location.pathname, location.search, recoveryIntentActive, isPasswordResetRequestMode]);

  useEffect(() => {
    if (!isSignUp) {
      setShowVerificationPrompt(false);
      setVerificationEmail("");
      setResendSeconds(0);
    }
  }, [isSignUp]);

  useEffect(() => {
    if (recoveryIntentActive) {
      if (!isPasswordResetMode) {
        setIsPasswordResetMode(true);
      }
      if (isPasswordResetRequestMode) {
        setIsPasswordResetRequestMode(false);
      }
      setShowPassword(false);
    } else if (isPasswordResetMode) {
      setIsPasswordResetMode(false);
    }
  }, [recoveryIntentActive, isPasswordResetMode, isPasswordResetRequestMode]);

  useEffect(() => {
    if (isPasswordResetMode || isPasswordResetRequestMode) {
      setShowVerificationPrompt(false);
      setResendSeconds(0);
    }
  }, [isPasswordResetMode, isPasswordResetRequestMode]);

  // Redirect if already logged in (unless we're handling recovery/invite flows)
  useEffect(() => {
    if (user && !shouldBypassRedirect(authIntent)) {
      navigate("/");
    }
  }, [user, navigate, authIntent]);

  const clearAuthState = () => {
    // Clear all auth related storage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  useEffect(() => {
    if (!recoveryIntentActive) return;
    const searchParams = new URLSearchParams(location.search);
    const emailFromQuery = (searchParams.get("email") || "").trim();
    if (emailFromQuery && emailFromQuery !== email) {
      setEmail(emailFromQuery);
    }
  }, [recoveryIntentActive, location.search, email]);

  useEffect(() => {
    if (!recoveryIntentActive || authLoading) {
      return;
    }

    let isMounted = true;

    const verifyRecoverySession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      const sessionUser = data?.session?.user;

      if (!sessionUser) {
        const copy = tMsg('auth.recovery_link_invalid', 'This recovery link is invalid or has expired. Request a new email to continue.');
        toast.error(copy);
        recordToast("error", "auth.recovery_link_invalid", copy);
        logAuthEvent("auth_recovery_session_missing", {
          errorMessage: error?.message || "missing_session",
        });
        setIsPasswordResetMode(false);
        setIsPasswordResetRequestMode(false);
        setShowPassword(false);
        navigate("/auth/signin", { replace: true });
        return;
      }

      if (!email && sessionUser.email) {
        setEmail(sessionUser.email);
      }
    };

    verifyRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [recoveryIntentActive, authLoading, email, navigate, tMsg, toast, recordToast]);

  const featureSlides = [
    {
      chip: tPages('auth.features.0.chip', 'Quick start'),
      title: tPages('auth.features.0.title', 'Stay organized from day one'),
      description: tPages(
        'auth.features.0.description',
        'Use a short onboarding guide to define your clients, shoot types, and packages. The to-do list walks you through every step so you never miss a critical setting.'
      ),
    },
    {
      chip: tPages('auth.features.1.chip', 'Automation'),
      title: tPages('auth.features.1.title', 'Send the right message at the right time'),
      description: tPages(
        'auth.features.1.description',
        "Define pre-shoot briefings, prep lists, and thank-you notes once. Templates and workflows reach your clients automatically so you don't have to chase every touchpoint."
      ),
    },
    {
      chip: tPages('auth.features.2.chip', 'Daily flow'),
      title: tPages('auth.features.2.title', 'Keep your shoot schedule crystal clear'),
      description: tPages(
        'auth.features.2.description',
        'See every session and reminder in day, week, or month view at a glance. Planning shoots, delivery dates, and to-dos becomes much easier.'
      ),
    },
  ];

  const currentFeatureChip =
    featureSlides[activeFeatureIndex]?.chip || tPages('auth.platformHighlights', 'Platform highlights');

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
    logAuthEvent(isSignUp ? "auth_sign_up_start" : "auth_sign_in_start", { email });

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
        if (data.user) {
          logAuthEvent("auth_sign_up_success", {
            email,
            supabaseUserId: data.user.id,
            emailConfirmed: Boolean(data.user.email_confirmed_at),
          });
        }

        if (data.user && !data.user.email_confirmed_at) {
          const copy = tMsg('auth.email_confirmation');
          logAuthEvent("auth_sign_up_pending_verification", {
            email,
            supabaseUserId: data.user.id,
          });
          toast.success(copy);
          recordToast("success", "auth.email_confirmation", copy);
          setVerificationEmail(email);
          setShowVerificationPrompt(true);
          setResendSeconds(120);
          setShowPassword(false);
          setLoading(false);
          return;
        } else if (data.user) {
          const copy = tMsg('auth.account_created');
          toast.success(copy);
          recordToast("success", "auth.account_created", copy);
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
        logAuthEvent("auth_sign_in_success", {
          email,
          supabaseUserId: data.user?.id,
        });
        const copy = tMsg('auth.signed_in');
        toast.success(copy);
        recordToast("success", "auth.signed_in", copy);
        
        // Navigate to home
        setTimeout(() => navigate("/"), 1000);
      }
    } catch (error: unknown) {
      console.error("Auth error:", error);
      const fallbackKey = 'auth.auth_error';
      let messageKey: string | undefined;
      let message: string;

      if (!isSignUp && error instanceof AuthApiError && error.status === 400) {
        messageKey = 'auth.invalid_credentials';
        message = tMsg(messageKey);
      } else if (error instanceof Error && error.message) {
        message = error.message;
      } else {
        messageKey = fallbackKey;
        message = tMsg(fallbackKey);
      }
      logAuthEvent(isSignUp ? "auth_sign_up_error" : "auth_sign_in_error", {
        email,
        errorMessage: message,
      });
      toast.error(message);
      recordToast("error", messageKey, message);
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!email) {
      const copy = tMsg('auth.reset_email_missing');
      toast.error(copy);
      recordToast("error", "auth.reset_email_missing", copy);
      logAuthEvent("auth_reset_request_error", {
        email,
        errorMessage: "missing_email",
      });
      return;
    }

    setResettingPassword(true);
    try {
      const recoveryRedirect = `${window.location.origin}/auth/signin?type=recovery`;
      logAuthEvent("auth_reset_request_start", { email, redirectTo: recoveryRedirect });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirect,
      });

      if (error) throw error;

      logAuthEvent("auth_reset_request_success", { email });
      const copy = tMsg('auth.reset_email_sent');
      toast.success(copy);
      recordToast("success", "auth.reset_email_sent", copy);
    } catch (error: unknown) {
      console.error("Reset password error:", error);
      const fallbackKey = 'auth.reset_email_error';
      const message =
        error instanceof Error && error.message
          ? error.message
          : tMsg(fallbackKey);
      logAuthEvent("auth_reset_request_error", {
        email,
        errorMessage: message,
      });
      toast.error(message);
      recordToast("error", error instanceof Error && error.message ? undefined : fallbackKey, message);
    } finally {
      setResettingPassword(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      const copy = tMsg('auth.password_too_short');
      toast.error(copy);
      recordToast("error", "auth.password_too_short", copy);
      logAuthEvent("auth_password_update_error", {
        errorMessage: "password_too_short_validation",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      const copy = tMsg('auth.password_mismatch');
      toast.error(copy);
      recordToast("error", "auth.password_mismatch", copy);
      logAuthEvent("auth_password_update_error", {
        errorMessage: "password_mismatch_validation",
      });
      return;
    }

    setUpdatingPassword(true);
    logAuthEvent("auth_password_update_start", {
      passwordLength: newPassword.length,
    });
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      logAuthEvent("auth_password_update_success", {});
      const copy = tMsg('auth.password_updated');
      toast.success(copy);
      recordToast("success", "auth.password_updated", copy);

      setIsPasswordResetMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setTimeout(() => navigate("/"), 1000);
    } catch (error: unknown) {
      console.error("Password update error:", error);
      const fallbackKey = 'auth.password_update_error';
      const message =
        error instanceof Error && error.message
          ? error.message
          : tMsg(fallbackKey);
      logAuthEvent("auth_password_update_error", {
        errorMessage: message,
      });
      toast.error(message);
      recordToast("error", error instanceof Error && error.message ? undefined : fallbackKey, message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = (verificationEmail || email || "").trim();

    if (!targetEmail) {
      const copy = tMsg('auth.verification_email_missing', 'Doğrulama bağlantısını tekrar göndermek için e-postanızı girin.');
      toast.error(copy);
      recordToast("error", "auth.verification_email_missing", copy);
      logAuthEvent("auth_sign_up_resend_error", {
        email: targetEmail,
        errorMessage: "missing_email",
      });
      return;
    }

    setResendingVerification(true);
    try {
      logAuthEvent("auth_sign_up_resend_start", { email: targetEmail });
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;
      const copy = tMsg('auth.verification_email_resent', 'Doğrulama e-postası yeniden gönderildi. Lütfen gelen kutunuzu kontrol edin.');
      toast.success(copy);
      recordToast("success", "auth.verification_email_resent", copy);
      logAuthEvent("auth_sign_up_resend_success", { email: targetEmail });
      setResendSeconds(120);
    } catch (error: unknown) {
      console.error("Verification resend error:", error);
      const fallbackKey = 'auth.auth_error';
      const message =
        error instanceof Error && error.message
          ? error.message
          : tMsg(fallbackKey);
      logAuthEvent("auth_sign_up_resend_error", {
        email: targetEmail,
        errorMessage: message,
      });
      toast.error(message);
      recordToast("error", error instanceof Error && error.message ? undefined : fallbackKey, message);
    } finally {
      setResendingVerification(false);
    }
  };

  const isVerificationPending = showVerificationPrompt && !isPasswordResetMode && !isPasswordResetRequestMode;
  const verificationTargetEmail = (verificationEmail || email || "").trim();
  const verificationEmailDisplay = verificationTargetEmail || tForm('placeholders.enter_email');
  const formattedResendTime = () => {
    const mins = Math.floor(resendSeconds / 60);
    const secs = resendSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(location.search);

    if (hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery") {
      if (getModeFromLocation(location.pathname, location.search) === "signup") {
        navigate("/auth/signin", { replace: true });
      }
      setIsSignUp(false);
      setIsPasswordResetRequestMode(false);
      setIsPasswordResetMode(true);
      setShowPassword(false);
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!isVerificationPending || resendSeconds <= 0) return;

    const interval = window.setInterval(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isVerificationPending, resendSeconds]);

  const authLabel = isVerificationPending
    ? tPages('auth.verification.badge', 'Email verification')
    : isPasswordResetMode
    ? tForm('auth.password_reset.title')
    : isPasswordResetRequestMode
    ? tForm('auth.password_reset.request_title')
    : isSignUp
    ? tForm('auth.sign_up.title')
    : tForm('auth.sign_in.title');

  const welcomeText = isVerificationPending
    ? tPages('auth.welcome.verify', 'Check your inbox ✉️')
    : isPasswordResetMode
    ? tPages('auth.welcome.recovery', 'Reset your password 🔐')
    : isPasswordResetRequestMode
    ? tPages('auth.welcome.recoveryRequest', 'Reset your password 🔐')
    : isSignUp
    ? tPages('auth.welcome.signUp', "Let's get started 🚀")
    : tPages('auth.welcome.signIn', 'Welcome back 👋🏻');

  const copyText = isVerificationPending
    ? tPages('auth.copy.verify', 'We sent a verification link to your inbox. Please confirm to continue.')
    : isPasswordResetMode
    ? tPages('auth.copy.recovery', 'Set a new password to regain access to your workspace.')
    : isPasswordResetRequestMode
    ? tPages('auth.copy.recoveryRequest', "We'll email you a secure link so you can choose a new password.")
    : isSignUp
    ? tPages('auth.copy.signUp', 'Create your Lumiso account to unlock collaborative workflows and beautiful client experiences.')
    : tPages('auth.copy.signIn', 'Sign in with your credentials to pick up exactly where your team left off.');

  const viewKey = isPasswordResetMode
    ? 'reset-update'
    : isPasswordResetRequestMode
    ? 'reset-request'
    : isVerificationPending
    ? 'verification'
    : isSignUp
    ? 'signup'
    : 'signin';

  return (
    <div className="flex min-h-screen w-full bg-white">
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden lg:flex-row">
        <div className="relative flex min-h-screen w-full flex-col px-6 py-8 pb-12 sm:px-10 sm:pb-12 lg:w-1/2 lg:px-12 lg:pb-10">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/10 via-white to-transparent" aria-hidden="true" />

          {/* Logo pinned to top-left */}
          <div className="absolute left-6 top-6 sm:left-10">
            <img src="/lumiso-logo.png" alt={tCommon('branding.app_name', 'Lumiso')} className="h-10 w-auto" loading="eager" />
          </div>

          <div className="flex flex-1 flex-col">
            {/* Centered form area */}
            <div className="flex flex-1 items-start pt-16 sm:pt-20 lg:items-center lg:pt-0">
              <div key={viewKey} className="relative mx-auto w-full max-w-md fade-in-up">
                <div className="mb-8 space-y-3">
                  <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    {authLabel}
                  </div>
                  <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                    {welcomeText}
                  </h1>
                  {isVerificationPending ? (
                    <p className="text-base text-slate-600">
                      {tPages('auth.verification.copyBefore', 'Doğrulama bağlantısını')}
                      {" "}
                      <span className="font-semibold text-slate-900">{verificationEmailDisplay}</span>
                      {" "}
                      {tPages('auth.verification.copyAfter', 'adresine gönderdik; çalışma alanını etkinleştirmek için onayla.')}
                    </p>
                  ) : (
                    <p className="text-base text-slate-500">{copyText}</p>
                  )}
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
                          aria-label={getPasswordToggleLabel(showPassword)}
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
                ) : isPasswordResetRequestMode ? (
                  <form onSubmit={handlePasswordResetRequest} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-sm font-medium text-slate-600">
                        {tForm('labels.email')}
                      </Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder={tForm('placeholders.enter_email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={resettingPassword}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/60 px-4 text-base shadow-inner transition focus:border-primary/60 focus:bg-white focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="group flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      disabled={resettingPassword}
                    >
                      {resettingPassword ? `${tMsg('info.loading')}...` : tForm('auth.password_reset.request_button', 'Send reset link')}
                    </Button>
                  </form>
                ) : isVerificationPending ? (
                  <>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
                        onClick={() => {
                          setIsSignUp(false);
                          setShowPassword(false);
                          setShowVerificationPrompt(false);
                          setVerificationEmail("");
                          navigate("/auth/signin");
                        }}
                      >
                        {tForm('auth.sign_in.button')}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:text-emerald-700 hover:shadow"
                        onClick={() => {
                          setShowVerificationPrompt(false);
                          setVerificationEmail("");
                          setPassword("");
                          setShowPassword(false);
                          setIsSignUp(true);
                          navigate("/auth/signup");
                        }}
                      >
                        {tPages('auth.verification.actions.useAnother', 'Use another email')}
                      </Button>
                    </div>

                    <div className="mt-4 space-y-0.5 text-sm text-slate-600">
                      <span className="block leading-tight">{tPages('auth.verification.actions.notReceived', "E-posta gelmedi mi?")}</span>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 font-semibold text-primary hover:text-primary/80 leading-tight"
                        onClick={handleResendVerification}
                        disabled={resendingVerification || loading || resendSeconds > 0}
                      >
                        {resendingVerification
                          ? `${tMsg('info.loading')}...`
                          : `${tPages('auth.verification.actions.resend', 'Doğrulama e-postasını yeniden gönder')}${resendSeconds > 0 ? ` (${formattedResendTime()})` : ''}`}
                      </Button>
                    </div>
                  </>
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
                            aria-label={getPasswordToggleLabel(showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                        {!isSignUp && (
                          <div className="flex justify-end pt-1">
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => {
                                setIsSignUp(false);
                                setIsPasswordResetMode(false);
                                setIsPasswordResetRequestMode(true);
                                setShowPassword(false);
                                navigate("/auth/signin");
                              }}
                              disabled={loading}
                              className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
                            >
                              {tForm('auth.sign_in.forgot_password')}
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
                        onClick={() => {
                          const nextIsSignUp = !isSignUp;
                          setIsSignUp(nextIsSignUp);
                          setIsPasswordResetMode(false);
                          setIsPasswordResetRequestMode(false);
                          setShowPassword(false);
                          navigate(nextIsSignUp ? "/auth/signup" : "/auth/signin");
                        }}
                        disabled={loading}
                        className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
                      >
                        {isSignUp ? tForm('auth.sign_in.button') : tForm('auth.sign_up.button')}
                      </Button>
                    </div>
                  </>
                )}
                {(isPasswordResetMode || isPasswordResetRequestMode) && (
                  <div className="mt-8 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                    <Button
                      variant="link"
                      onClick={() => {
                        setIsPasswordResetRequestMode(false);
                        setIsPasswordResetMode(false);
                        setNewPassword("");
                        setConfirmPassword("");
                        setShowPassword(false);
                        setIsSignUp(false);
                        navigate("/auth/signin");
                      }}
                      disabled={updatingPassword || resettingPassword}
                      className="px-0 text-sm font-semibold text-primary hover:text-primary/80"
                    >
                      {tForm('auth.password_reset.back_to_sign_in')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden pt-6 text-xs text-slate-400 sm:block">
              <span>© {new Date().getFullYear()} {tCommon('branding.app_name', 'Lumiso')}. {tCommon('legal.all_rights_reserved', 'All rights reserved.')}</span>
            </div>
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
                {currentFeatureChip}
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
