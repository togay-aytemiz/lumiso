import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global cache to prevent duplicate requests
let userCache: { user: User | null; timestamp: number } | null = null;
let ongoingUserFetch: Promise<User | null> | null = null;
const USER_CACHE_DURATION = 60000; // 1 minute

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (): Promise<User | null> => {
    // Return cached user if still fresh
    if (userCache && Date.now() - userCache.timestamp < USER_CACHE_DURATION) {
      return userCache.user;
    }

    // If there's already an ongoing fetch, wait for it
    if (ongoingUserFetch) {
      return await ongoingUserFetch;
    }

    try {
      // Create the fetch promise and store it
      ongoingUserFetch = (async () => {
        const { data: { user: fetchedUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Error fetching user:', error);
          return null;
        }

        userCache = { user: fetchedUser, timestamp: Date.now() };
        return fetchedUser;
      })();

      return await ongoingUserFetch;
    } finally {
      ongoingUserFetch = null;
    }
  };

  const refreshUser = async () => {
    setLoading(true);
    // Clear cache to force fresh fetch
    userCache = null;
    const fetchedUser = await fetchUser();
    setUser(fetchedUser);
    setLoading(false);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      userCache = null; // Clear cache
      setUser(null);
      setSession(null);
      localStorage.clear();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Update cache
        if (session?.user) {
          userCache = { user: session.user, timestamp: Date.now() };
        } else {
          userCache = null;
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        console.log('Initial session:', session?.user?.id);
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          userCache = { user: session.user, timestamp: Date.now() };
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Session check error:', error);
        setLoading(false);
      }
    };

    getInitialSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshUser }}>
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