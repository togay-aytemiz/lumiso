import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'support' | 'user';

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