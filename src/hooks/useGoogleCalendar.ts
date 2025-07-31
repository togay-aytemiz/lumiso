import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarConnection {
  connected: boolean;
  email?: string;
  expired?: boolean;
}

export const useGoogleCalendar = () => {
  const [connection, setConnection] = useState<CalendarConnection>({ connected: false });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkConnectionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setConnection({ connected: false });
        return;
      }

      const response = await fetch(
        `https://rifdykpdubrowzbylffe.supabase.co/functions/v1/google-calendar-oauth?action=status`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to check connection status:', response.status, response.statusText);
        setConnection({ connected: false });
        return;
      }

      const data = await response.json();
      setConnection(data);

      if (data.expired) {
        toast({
          title: "Session expired",
          description: "Please reconnect your calendar.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnection({ connected: false });
    }
  };

  const connectCalendar = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to connect your calendar.",
          variant: "destructive",
        });
        return;
      }

      console.log('Starting Google Calendar connection for user:', session.user.id);

      // Create state parameter with user ID
      const state = btoa(JSON.stringify({ userId: session.user.id }));
      console.log('Created state parameter:', state);

      const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
        body: { action: 'authorize', state },
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      console.log('Authorization response:', { data, error });

      if (error) {
        throw error;
      }

      if (!data.authUrl) {
        throw new Error('No authorization URL received');
      }

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'google-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for popup messages
      const messageListener = (event: MessageEvent) => {
        if (event.data.type === 'google-calendar-connected') {
          setConnection({
            connected: true,
            email: event.data.email
          });
          
          toast({
            title: "Google Calendar Connected",
            description: `Successfully connected as ${event.data.email}`,
          });

          popup?.close();
          window.removeEventListener('message', messageListener);
          setLoading(false);
        } else if (event.data.type === 'google-calendar-error') {
          console.error('OAuth error from popup:', event.data);
          
          toast({
            title: "Connection failed",
            description: event.data.description || "Failed to connect to Google Calendar. Please try again.",
            variant: "destructive",
          });

          popup?.close();
          window.removeEventListener('message', messageListener);
          setLoading(false);
        }
      };

      window.addEventListener('message', messageListener);

      // Check if popup was closed without completing auth
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setLoading(false);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to connect calendar:', error);
      toast({
        title: "Connection failed",
        description: "Failed to connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectCalendar = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
        body: { action: 'disconnect' },
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (error || !data.success) {
        throw new Error('Failed to disconnect calendar');
      }

      setConnection({ connected: false });
      
      toast({
        title: "Google Calendar Disconnected",
        description: "Successfully disconnected from your Google Calendar.",
      });

    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      toast({
        title: "Disconnection failed",
        description: "Failed to disconnect from Google Calendar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  return {
    connection,
    loading,
    connectCalendar,
    disconnectCalendar,
    refreshStatus: checkConnectionStatus
  };
};