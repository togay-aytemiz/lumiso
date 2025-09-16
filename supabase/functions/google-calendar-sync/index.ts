import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, type, entityId, eventData } = await req.json();

    console.log('Calendar sync action:', action, 'type:', type, 'entityId:', entityId);

    // Get user's Google Calendar tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', user.id)
      .single();

    if (tokensError || !tokens) {
      return new Response(JSON.stringify({ error: 'No Google Calendar connection found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.access_token;
    const isExpired = new Date(tokens.token_expiry) <= new Date();
    
    if (isExpired && tokens.refresh_token) {
      console.log('Token expired, refreshing...');
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '',
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to refresh token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
      await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    if (action === 'create') {
      return await createCalendarEvent(supabase, accessToken, type, entityId, eventData, user.id);
    } else if (action === 'update') {
      return await updateCalendarEvent(supabase, accessToken, type, entityId, eventData, user.id);
    } else if (action === 'delete') {
      return await deleteCalendarEvent(supabase, accessToken, type, entityId, user.id);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Calendar sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createCalendarEvent(
  supabase: any,
  accessToken: string,
  type: string,
  entityId: string,
  eventData: GoogleCalendarEvent,
  userId: string
) {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to create calendar event:', errorText);
    throw new Error('Failed to create calendar event');
  }

  const event = await response.json();
  console.log('Created calendar event:', event.id);

  // Update the database record with the Google event ID
  const table = type === 'session' ? 'sessions' : 'activities';
  await supabase
    .from(table)
    .update({ google_event_id: event.id })
    .eq('id', entityId)
    .eq('user_id', userId);

  return new Response(JSON.stringify({ success: true, eventId: event.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateCalendarEvent(
  supabase: any,
  accessToken: string,
  type: string,
  entityId: string,
  eventData: GoogleCalendarEvent,
  userId: string
) {
  // Get the Google event ID from database
  const table = type === 'session' ? 'sessions' : 'activities';
  const { data: record } = await supabase
    .from(table)
    .select('google_event_id')
    .eq('id', entityId)
    .eq('user_id', userId)
    .single();

  if (!record?.google_event_id) {
    return new Response(JSON.stringify({ error: 'No Google event ID found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${record.google_event_id}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update calendar event:', errorText);
    throw new Error('Failed to update calendar event');
  }

  console.log('Updated calendar event:', record.google_event_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function deleteCalendarEvent(
  supabase: any,
  accessToken: string,
  type: string,
  entityId: string,
  userId: string
) {
  // Get the Google event ID from database
  const table = type === 'session' ? 'sessions' : 'activities';
  const { data: record } = await supabase
    .from(table)
    .select('google_event_id')
    .eq('id', entityId)
    .eq('user_id', userId)
    .single();

  if (!record?.google_event_id) {
    return new Response(JSON.stringify({ error: 'No Google event ID found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${record.google_event_id}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    console.error('Failed to delete calendar event:', errorText);
    throw new Error('Failed to delete calendar event');
  }

  console.log('Deleted calendar event:', record.google_event_id);

  // Clear the Google event ID from database
  await supabase
    .from(table)
    .update({ google_event_id: null })
    .eq('id', entityId)
    .eq('user_id', userId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}