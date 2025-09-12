import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface OnlineUser {
  user_id: string;
  last_seen: string;
  is_online: boolean;
}

export function useOptimizedPresence() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const { activeOrganization } = useOrganization();
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const updatePresence = useCallback(async (status: 'online' | 'offline') => {
    if (!activeOrganization?.id) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Update presence in the database
      const { error } = await supabase
        .from('organization_members')
        .update({
          last_active: new Date().toISOString(),
          // Note: is_online field might not exist in the current schema
          // This would need to be added via migration if needed
        })
        .eq('organization_id', activeOrganization.id)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('Error updating presence:', error);
      }
    } catch (error) {
      console.error('Error in updatePresence:', error);
    }
  }, [activeOrganization?.id]);

  const startTracking = useCallback(async () => {
    if (!activeOrganization?.id || isTracking) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Set up realtime channel for presence
      const channelName = `organization:${activeOrganization.id}:presence`;
      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: user.user.id,
          },
        },
      });

      // Track presence events
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const users: OnlineUser[] = [];
          
          Object.entries(presenceState).forEach(([userId, presence]) => {
            if (Array.isArray(presence) && presence.length > 0) {
              users.push({
                user_id: userId,
                last_seen: new Date().toISOString(),
                is_online: true,
              });
            }
          });
          
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          setOnlineUsers(prev => {
            const updated = prev.filter(u => u.user_id !== key);
            return [...updated, {
              user_id: key,
              last_seen: new Date().toISOString(),
              is_online: true,
            }];
          });
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          setOnlineUsers(prev => 
            prev.map(u => 
              u.user_id === key 
                ? { ...u, is_online: false, last_seen: new Date().toISOString() }
                : u
            )
          );
        });

      // Subscribe to the channel
      const status = await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track this user's presence
          await channel.track({
            user_id: user.user.id,
            online_at: new Date().toISOString(),
          });
          
          setIsTracking(true);
        }
      });

      channelRef.current = channel;

      // Set up heartbeat to maintain presence
      heartbeatRef.current = setInterval(async () => {
        if (channelRef.current) {
          await channelRef.current.track({
            user_id: user.user.id,
            online_at: new Date().toISOString(),
          });
        }
        await updatePresence('online');
      }, 30000); // Update every 30 seconds

      // Update presence immediately
      await updatePresence('online');

    } catch (error) {
      console.error('Error starting presence tracking:', error);
    }
  }, [activeOrganization?.id, isTracking, updatePresence]);

  const stopTracking = useCallback(async () => {
    if (!isTracking) return;

    try {
      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      // Unsubscribe from channel
      if (channelRef.current) {
        // Mark as offline before leaving
        await updatePresence('offline');
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      setIsTracking(false);
      setOnlineUsers([]);
    } catch (error) {
      console.error('Error stopping presence tracking:', error);
    }
  }, [isTracking, updatePresence]);

  const isUserOnline = useCallback((userId: string): boolean => {
    const user = onlineUsers.find(u => u.user_id === userId);
    return user?.is_online || false;
  }, [onlineUsers]);

  const getUserLastSeen = useCallback((userId: string): string | null => {
    const user = onlineUsers.find(u => u.user_id === userId);
    return user?.last_seen || null;
  }, [onlineUsers]);

  // Start tracking when organization changes
  useEffect(() => {
    if (activeOrganization?.id) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [activeOrganization?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('offline');
      } else {
        updatePresence('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updatePresence]);

  return {
    onlineUsers,
    isTracking,
    startTracking,
    stopTracking,
    isUserOnline,
    getUserLastSeen,
    totalOnline: onlineUsers.filter(u => u.is_online).length,
  };
}