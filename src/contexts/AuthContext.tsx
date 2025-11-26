import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'support' | 'user';

type ConfirmationNotifiedMap = Record<string, string>;
type ConfirmationInFlightMap = Record<string, true>;

const CONFIRM_NOTIFY_STORAGE_KEY = 'lumiso.emailConfirmed.notified';
const RECENT_CONFIRM_WINDOW_MINUTES = 120;
const inFlightConfirmations: ConfirmationInFlightMap = {};

const loadConfirmationNotified = (): ConfirmationNotifiedMap => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CONFIRM_NOTIFY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const markConfirmationNotified = (userId: string, confirmedAtIso: string) => {
  if (typeof localStorage === 'undefined') return;
  const current = loadConfirmationNotified();
  current[userId] = confirmedAtIso;
  try {
    localStorage.setItem(CONFIRM_NOTIFY_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Best-effort only
  }
};

const escapeForEmail = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRoles: UserRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data: roles, error } = await supabase
        .rpc('get_user_roles', { user_uuid: userId });
      
      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }
      
      return roles || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  };

  const signOut = async () => {
    try {
      // Clear everything first
      localStorage.clear();
      setUser(null);
      setSession(null);
      setUserRoles([]);
      
      // Then sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Use window navigation for auth redirect
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force reload anyway
      window.location.href = '/auth';
    }
  };

  useEffect(() => {
    console.log('AuthProvider initializing...');
    
    let isMounted = true;

    const sendConfirmationNotification = async (
      confirmedUser: User,
      confirmedAtIso: string
    ) => {
      const inFlightKey = `${confirmedUser.id}:${confirmedAtIso}`;
      if (inFlightConfirmations[inFlightKey]) {
        return;
      }
      inFlightConfirmations[inFlightKey] = true;

      const confirmationDate = new Date(confirmedAtIso);
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
      const locale =
        typeof navigator !== 'undefined' ? navigator.language : 'unknown';
      const localConfirmed = confirmationDate.toLocaleString(undefined, {
        timeZone: timezone === 'unknown' ? undefined : timezone,
      });

      const userMeta = (confirmedUser.user_metadata || {}) as Record<string, unknown>;
      const legalConsents = (userMeta.legal_consents || {}) as Record<
        string,
        { version?: string | number | null; acceptedAt?: string }
      >;
      const consentLabels: Record<string, string> = {
        terms: 'Terms',
        privacy: 'Privacy',
        kvkk: 'KVKK',
        dpa: 'DPA',
        marketing: 'Marketing',
      };

      const consentLines = Object.entries(legalConsents)
        .map(([key, consent]) => {
          const label = consentLabels[key] || key;
          const versionLabel =
            consent?.version !== null && consent?.version !== undefined
              ? `v${consent.version}`
              : 'version unknown';
          const acceptedAt = consent?.acceptedAt || consent?.accepted_at;
          const acceptedLocal = acceptedAt
            ? new Date(String(acceptedAt)).toLocaleString(undefined, {
                timeZone: timezone === 'unknown' ? undefined : timezone,
              })
            : null;
          return `${label}: ${versionLabel}${
            acceptedLocal ? ` @ ${acceptedLocal} (${acceptedAt})` : ''
          }`;
        })
        .map(escapeForEmail);

      const detailLines = [
        `Email: ${escapeForEmail(confirmedUser.email)}`,
        `Supabase user id: ${escapeForEmail(confirmedUser.id)}`,
        `Confirmed at (ISO): ${escapeForEmail(confirmedAtIso)}`,
        `Confirmed local time (${timezone}): ${escapeForEmail(localConfirmed)}`,
        `Locale: ${escapeForEmail(locale)}`,
        `Marketing opt-in: ${userMeta.marketing_opt_in ? 'yes' : 'no'}`,
        `Accepted terms flag: ${userMeta.accepted_terms ? 'yes' : 'no'}`,
      ];

      const blocks = [
        {
          id: 'email-confirmed-header',
          type: 'header',
          order: 0,
          data: {
            title: 'Email confirmed',
            tagline: 'Auth verification capture',
          },
        },
        {
          id: 'email-confirmed-details',
          type: 'text',
          order: 1,
          data: {
            content: detailLines.join('\n'),
            formatting: { bullets: true },
          },
        },
      ] as Array<{
        id: string;
        type: string;
        order: number;
        data: Record<string, unknown>;
      }>;

      if (consentLines.length > 0) {
        blocks.push({
          id: 'email-confirmed-consents',
          type: 'text',
          order: 2,
          data: {
            content: consentLines.join('\n'),
            formatting: { bullets: true },
          },
        });
      }

      try {
        const { error } = await supabase.functions.invoke('send-template-email', {
          body: {
            to: 'support@lumiso.app',
            subject: `Email confirmed: ${confirmedUser.email}`,
            preheader: `Confirmed at ${localConfirmed} (${timezone})`,
            blocks,
            metadata: {
              intent: 'support-email-confirmation',
              user_id: confirmedUser.id,
              confirmed_at_iso: confirmedAtIso,
              email: confirmedUser.email || '',
              locale,
              timezone,
            },
          },
        });

        if (error) {
          console.error('Failed to send support confirmation email', error);
        } else {
          console.info('Support confirmation email sent', {
            email: confirmedUser.email,
            confirmedAtIso,
          });
        }
      } catch (error) {
        console.error('Support confirmation email error', error);
      } finally {
        delete inFlightConfirmations[inFlightKey];
      }
    };

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
        }

        if (isMounted && !initialized) {
          console.log('Setting initial auth state:', session?.user?.id || 'no user');
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch user roles if user exists
          if (session?.user) {
            setTimeout(async () => {
              const roles = await fetchUserRoles(session.user.id);
              if (isMounted) {
                setUserRoles(roles);
              }
            }, 0);
          }
          
          setLoading(false);
          setInitialized(true);

          // Notify support for fresh confirmations (guarded to avoid spam)
          const confirmedAt = session?.user?.email_confirmed_at;
          if (session?.user?.id && confirmedAt) {
            const confirmedAtIso = new Date(confirmedAt).toISOString();
            const notified = loadConfirmationNotified();
            const alreadyMarked = notified[session.user.id] === confirmedAtIso;
            const inFlightKey = `${session.user.id}:${confirmedAtIso}`;
            const ageMinutes =
              (Date.now() - new Date(confirmedAtIso).getTime()) / 60000;
            const isFresh =
              ageMinutes >= 0 && ageMinutes <= RECENT_CONFIRM_WINDOW_MINUTES;

            if (!alreadyMarked && isFresh && !inFlightConfirmations[inFlightKey]) {
              // Optimistically mark to prevent duplicate sends from concurrent listeners
              markConfirmationNotified(session.user.id, confirmedAtIso);
              void sendConfirmationNotification(session.user, confirmedAtIso);
            } else if (!alreadyMarked) {
              markConfirmationNotified(session.user.id, confirmedAtIso);
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id || 'no user');
        
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch user roles if user exists
          if (session?.user) {
            setTimeout(async () => {
              const roles = await fetchUserRoles(session.user.id);
              if (isMounted) {
                setUserRoles(roles);
              }
            }, 0);
          } else {
            setUserRoles([]);
          }
          
          // Only set loading to false if we haven't initialized yet
          if (!initialized) {
            setLoading(false);
            setInitialized(true);
          }

          // Notify support for fresh confirmations on auth state change
          const confirmedAt = session?.user?.email_confirmed_at;
          if (session?.user?.id && confirmedAt) {
            const confirmedAtIso = new Date(confirmedAt).toISOString();
            const notified = loadConfirmationNotified();
            const alreadyMarked = notified[session.user.id] === confirmedAtIso;
            const inFlightKey = `${session.user.id}:${confirmedAtIso}`;
            const ageMinutes =
              (Date.now() - new Date(confirmedAtIso).getTime()) / 60000;
            const isFresh =
              ageMinutes >= 0 && ageMinutes <= RECENT_CONFIRM_WINDOW_MINUTES;

            if (!alreadyMarked && isFresh && !inFlightConfirmations[inFlightKey]) {
              markConfirmationNotified(session.user.id, confirmedAtIso);
              void sendConfirmationNotification(session.user, confirmedAtIso);
            } else if (!alreadyMarked) {
              markConfirmationNotified(session.user.id, confirmedAtIso);
            }
          }
        }
      }
    );

    // Initialize auth state
    initializeAuth();

    return () => {
      console.log('AuthProvider cleanup...');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initialized]);

  return (
    <AuthContext.Provider value={{ user, session, userRoles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
