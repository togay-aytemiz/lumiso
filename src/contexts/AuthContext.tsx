import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
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
      localStorage.clear();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    // Initial user fetch
    const initializeUser = async () => {
      const fetchedUser = await fetchUser();
      setUser(fetchedUser);
      setLoading(false);
    };

    initializeUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          userCache = { user: session?.user || null, timestamp: Date.now() };
          setUser(session?.user || null);
        } else if (event === 'SIGNED_OUT') {
          userCache = null;
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
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