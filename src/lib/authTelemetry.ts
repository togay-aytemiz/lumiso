import { trackEvent } from "./telemetry";

type AuthDebugWindow = Window &
  typeof globalThis & {
    __lumisoAuthEvents?: Array<{
      event: AuthEvent;
      payload: AuthEventPayload & { timestamp: string };
    }>;
  };

const appendAuthBreadcrumb = (
  event: AuthEvent,
  payload: AuthEventPayload & { timestamp: string }
) => {
  if (typeof window === "undefined") return;
  const debugWindow = window as AuthDebugWindow;
  if (!Array.isArray(debugWindow.__lumisoAuthEvents)) {
    debugWindow.__lumisoAuthEvents = [];
  }
  debugWindow.__lumisoAuthEvents.push({ event, payload });
  const MAX = 50;
  if (debugWindow.__lumisoAuthEvents.length > MAX) {
    debugWindow.__lumisoAuthEvents.splice(
      0,
      debugWindow.__lumisoAuthEvents.length - MAX
    );
  }
};

type AuthEvent =
  | "auth_sign_in_start"
  | "auth_sign_in_success"
  | "auth_sign_in_error"
  | "auth_sign_up_start"
  | "auth_sign_up_success"
  | "auth_sign_up_error"
  | "auth_reset_request_start"
  | "auth_reset_request_success"
  | "auth_reset_request_error"
  | "auth_password_update_start"
  | "auth_password_update_success"
  | "auth_password_update_error"
  | "auth_toast_triggered"
  | "auth_recovery_session_missing";

export type AuthEventPayload = {
  email?: string;
  redirectTo?: string;
  supabaseUserId?: string;
  errorMessage?: string;
  toastVariant?: "success" | "error";
  toastMessageKey?: string;
  toastCopy?: string;
  [key: string]: unknown;
};

const redactEmail = (email?: string) => {
  if (!email) return undefined;
  const [localPart, domain] = email.split("@");
  if (!domain) {
    return `${localPart?.slice(0, 1) ?? ""}***`;
  }
  if (!localPart) {
    return `***@${domain}`;
  }
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}***${localPart.slice(-1)}@${domain}`;
};

export const logAuthEvent = (event: AuthEvent, payload: AuthEventPayload = {}) => {
  const safePayload = {
    ...payload,
    email: redactEmail(payload.email),
    timestamp: new Date().toISOString(),
  };

  trackEvent(event, {
    source: "auth-ui",
    ...safePayload,
  });

  appendAuthBreadcrumb(event, safePayload);

  if (import.meta.env.DEV) {
    console.info("[auth-event]", event, safePayload);
  }
};
