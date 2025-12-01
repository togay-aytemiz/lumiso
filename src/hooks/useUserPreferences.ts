import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingStage } from "@/constants/onboarding";

export interface UserPreferences {
  // User Settings
  userId: string;
  activeOrganizationId: string | null;
  pageVideos?: Record<
    string,
    {
      status: "not_seen" | "snoozed" | "completed";
      lastPromptedAt?: string | null;
    }
  >;
  
  // Onboarding Data
  onboardingStage: OnboardingStage;
  currentOnboardingStep: number;
  welcomeModalShown: boolean;
  
  // Organization Settings
  organizationId: string | null;
  businessName: string;
  logoUrl: string | null;
  primaryBrandColor: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  
  // User Profile
  displayName: string | null;
  avatarUrl: string | null;
  
  // Timestamps
  lastUpdated: string;
}

const PREFERENCES_CACHE_KEY = "user-preferences";
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in ms

let pageVideosColumnAvailable: boolean | null = null;

// Fetch all user preferences in a single optimized query
async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  console.log("🔄 fetchUserPreferences: Starting unified fetch for user", userId);
  
  // Single query to get essential onboarding data (only columns we know exist)
  const selectColumns = `
      user_id,
      onboarding_stage,
      current_onboarding_step,
      welcome_modal_shown,
      page_videos,
      updated_at
    `;

  let data: any;
  let error: any;

  ({ data, error } = await supabase
    .from('user_settings')
    .select(selectColumns)
    .eq('user_id', userId)
    .maybeSingle());

  if (error?.code === "42703") {
    console.warn("🔄 fetchUserPreferences: page_videos column missing, continuing without it");
    pageVideosColumnAvailable = false;
    ({ data, error } = await supabase
      .from('user_settings')
      .select(`
        user_id,
        onboarding_stage,
        current_onboarding_step,
        welcome_modal_shown,
        updated_at
      `)
      .eq('user_id', userId)
      .maybeSingle());
  } else if (!error) {
    pageVideosColumnAvailable = true;
  }

  if (error) {
    console.error("🔄 fetchUserPreferences: Database error:", error);
    throw error;
  }

  // Create default preferences for new users
  if (!data) {
    console.log("🔄 fetchUserPreferences: No data found, creating defaults");
    
    // Create minimal default user settings (only essential columns)
    const baseInsert: Record<string, unknown> = {
      user_id: userId,
      onboarding_stage: 'not_started',
      current_onboarding_step: 1,
      welcome_modal_shown: false
    };

    if (pageVideosColumnAvailable !== false) {
      baseInsert.page_videos = {};
    }

    const { error: insertError } = await supabase
      .from('user_settings')
      .insert(baseInsert);

    if (insertError) {
      console.error("🔄 fetchUserPreferences: Error creating defaults:", insertError);
      throw insertError;
    }

    // Return default preferences
    return {
      userId,
      activeOrganizationId: null,
      pageVideos: {},
      onboardingStage: 'not_started' as OnboardingStage,
      currentOnboardingStep: 1,
      welcomeModalShown: false,
      organizationId: null,
      businessName: '',
      logoUrl: null,
      primaryBrandColor: '#1EB29F',
      timezone: 'UTC',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12-hour',
      displayName: null,
      avatarUrl: null,
      lastUpdated: new Date().toISOString()
    };
  }

  const preferences: UserPreferences = {
    userId: data.user_id,
    activeOrganizationId: null, // Will get from organization context
    pageVideos: (pageVideosColumnAvailable !== false && data.page_videos) || {},
    onboardingStage: (data.onboarding_stage as OnboardingStage) || 'not_started',
    currentOnboardingStep: data.current_onboarding_step || 1,
    welcomeModalShown: data.welcome_modal_shown || false,
    organizationId: null, // Will get from organization context
    businessName: '', // Will get from organization settings
    logoUrl: null, // Will get from organization settings
    primaryBrandColor: '#1EB29F', // Will get from organization settings
    timezone: 'UTC', // Will get from organization settings
    dateFormat: 'DD/MM/YYYY', // Will get from organization settings
    timeFormat: '12-hour', // Default value
    displayName: null, // Will get from profiles table
    avatarUrl: null, // Will get from profiles table
    lastUpdated: data.updated_at || new Date().toISOString()
  };

  console.log("🔄 fetchUserPreferences: Successfully fetched preferences", {
    onboardingStage: preferences.onboardingStage,
    welcomeModalShown: preferences.welcomeModalShown,
    currentStep: preferences.currentOnboardingStep
  });

  return preferences;
}

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [PREFERENCES_CACHE_KEY, user?.id],
    queryFn: () => fetchUserPreferences(user!.id),
    enabled: !!user?.id,
    staleTime: CACHE_TTL, // Consider data fresh for 12 hours
    gcTime: CACHE_TTL * 2, // Keep in cache for 24 hours
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Do refetch on reconnect
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Update preferences function with optimistic updates
  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user?.id) return;

    console.log("🔄 updatePreferences: Updating with optimistic update", updates);

    // Optimistic update
    queryClient.setQueryData(
      [PREFERENCES_CACHE_KEY, user.id],
      (old: UserPreferences | undefined) => {
        if (!old) return old;
        return { ...old, ...updates, lastUpdated: new Date().toISOString() };
      }
    );

    try {
      // Update database (onboarding + lightweight page video prefs)
      const updateData: {
        onboarding_stage?: OnboardingStage;
        current_onboarding_step?: number;
        welcome_modal_shown?: boolean;
        page_videos?: UserPreferences["pageVideos"];
      } = {};
      
      if (updates.onboardingStage !== undefined) updateData.onboarding_stage = updates.onboardingStage;
      if (updates.currentOnboardingStep !== undefined) updateData.current_onboarding_step = updates.currentOnboardingStep;
      if (updates.welcomeModalShown !== undefined) updateData.welcome_modal_shown = updates.welcomeModalShown;
      if (updates.pageVideos !== undefined && pageVideosColumnAvailable !== false) {
        updateData.page_videos = updates.pageVideos;
      }
      
      // Only update if we have data to update
      if (Object.keys(updateData).length === 0) {
        console.log("🔄 updatePreferences: No onboarding data to update, skipping");
        return;
      }

      const { error } = await supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === "42703") {
          console.warn("🔄 updatePreferences: page_videos column missing, skipping page video updates");
          pageVideosColumnAvailable = false;
        } else {
          throw error;
        }
      }

      console.log("🔄 updatePreferences: Database updated successfully");
      
      // Invalidate and refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: [PREFERENCES_CACHE_KEY, user.id] });
      
    } catch (error) {
      console.error("🔄 updatePreferences: Error updating preferences:", error);
      
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: [PREFERENCES_CACHE_KEY, user.id] });
      throw error;
    }
  };

  // Forced refresh function for login/logout/org switch
  const forceRefresh = () => {
    console.log("🔄 forceRefresh: Forcing preferences refresh");
    queryClient.invalidateQueries({ queryKey: [PREFERENCES_CACHE_KEY] });
  };

  // Clear cache function
  const clearCache = () => {
    console.log("🔄 clearCache: Clearing preferences cache");
    queryClient.removeQueries({ queryKey: [PREFERENCES_CACHE_KEY] });
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updatePreferences,
    forceRefresh,
    clearCache,
    // Convenience computed values
    isReady: !query.isLoading && !!query.data,
    cacheStatus: query.isStale ? 'stale' : 'fresh'
  };
}
