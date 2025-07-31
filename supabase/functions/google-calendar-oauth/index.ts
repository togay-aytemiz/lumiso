import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleUserInfo {
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request received');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    console.log(`Request received: ${req.method} ${req.url}`);
    console.log('URL search params:', url.searchParams.toString());
    console.log('Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    // If action is not in URL params, try to get it from request body
    if (!action && req.method === 'POST') {
      try {
        const body = await req.json();
        action = body.action;
        console.log('Action from request body:', action);
      } catch (e) {
        console.log('Failed to parse request body:', e.message);
      }
    }

    console.log('Google Calendar OAuth action:', action);
    
    // Log environment variables (without exposing secrets)
    console.log('Environment check:', {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? 'SET' : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'SET' : 'NOT SET',
      GOOGLE_OAUTH_CLIENT_ID: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ? 'SET' : 'NOT SET',
      GOOGLE_OAUTH_CLIENT_SECRET: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ? 'SET' : 'NOT SET'
    });

    if (action === 'authorize') {
      // Generate OAuth URL
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
      if (!clientId) {
        throw new Error('Google OAuth Client ID not configured');
      }

      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth?action=callback`;
      const scope = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Get state from request body for POST requests
      let state = '';
      if (req.method === 'POST') {
        try {
          const body = await req.json();
          state = body.state || '';
        } catch (e) {
          console.log('Failed to parse request body for state:', e.message);
        }
      } else {
        state = url.searchParams.get('state') || '';
      }

      if (state) {
        authUrl.searchParams.set('state', state);
        console.log('Added state parameter to auth URL');
      }

      console.log('Generated auth URL:', authUrl.toString());

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'callback') {
      // Handle OAuth callback
      console.log('=== CALLBACK REQUEST RECEIVED ===');
      console.log('Full URL:', req.url);
      console.log('All URL params:', Object.fromEntries(url.searchParams.entries()));
      
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      console.log('Callback parameters:', { 
        code: code ? 'PRESENT' : 'MISSING', 
        state: state ? 'PRESENT' : 'MISSING', 
        error: error || 'NONE',
        errorDescription: errorDescription || 'NONE'
      });

      if (error) {
        console.error('OAuth error received:', error, errorDescription);
        return new Response(`
          <html>
            <head><title>Authorization Failed</title></head>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              ${errorDescription ? `<p>Description: ${errorDescription}</p>` : ''}
              <p>Please close this window and try again.</p>
              <script>
                console.error('OAuth error:', '${error}', '${errorDescription || ''}');
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'google-calendar-error',
                    error: '${error}',
                    description: '${errorDescription || ''}'
                  }, '*');
                }
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      if (!code) {
        console.error('No authorization code received in callback');
        console.log('All search params:', url.searchParams.toString());
        throw new Error('No authorization code received');
      }

      console.log('✅ OAuth callback received with valid code');

      // Exchange code for tokens
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth?action=callback`;

      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        throw new Error('Failed to exchange authorization code for tokens');
      }

      const tokens: GoogleTokenResponse = await tokenResponse.json();
      console.log('Successfully obtained tokens');

      // Get user email
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userInfo: GoogleUserInfo = await userInfoResponse.json();
      console.log('User info:', userInfo.email);

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Extract user ID from state parameter
      let userId = null;
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          userId = stateData.userId;
          console.log('Successfully extracted user ID from state:', userId);
        } catch (e) {
          console.error('Failed to parse state parameter:', e);
          console.log('Raw state value:', state);
        }
      } else {
        console.warn('No state parameter provided in callback - user ID cannot be determined');
      }

      // Store tokens in database if we have a user ID
      if (userId) {
        console.log('Storing tokens for user:', userId);
        
        // Check if user already has tokens
        const { data: existingTokens } = await supabase
          .from('google_calendar_tokens')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (existingTokens) {
          // Update existing tokens
          const { error: updateError } = await supabase
            .from('google_calendar_tokens')
            .update({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              token_expiry: tokenExpiry,
              user_email: userInfo.email,
              scope: tokens.scope,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          if (updateError) {
            console.error('Failed to update tokens:', updateError);
            throw updateError;
          }
        } else {
          // Insert new tokens
          const { error: insertError } = await supabase
            .from('google_calendar_tokens')
            .insert({
              user_id: userId,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              token_expiry: tokenExpiry,
              user_email: userInfo.email,
              scope: tokens.scope,
            });

          if (insertError) {
            console.error('Failed to insert tokens:', insertError);
            throw insertError;
          }
        }

        console.log('Tokens stored successfully');
      } else {
        console.error('Cannot store tokens: no user ID available');
        return new Response(`
          <html>
            <head><title>Authorization Error</title></head>
            <body>
              <h1>Authorization Error</h1>
              <p>Unable to complete authorization - user session not found.</p>
              <p>Please close this window and try again.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'google-calendar-error',
                    error: 'no_user_session',
                    description: 'User session not found in state parameter'
                  }, '*');
                }
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Return success page
      return new Response(`
        <html>
          <body>
            <h1>Google Calendar Connected Successfully!</h1>
            <p>Connected as: ${userInfo.email}</p>
            <p>You can now close this window.</p>
            <script>
              // Send message to parent window
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'google-calendar-connected',
                  email: '${userInfo.email}'
                }, '*');
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });

    } else if (action === 'status') {
      // Check connection status
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ connected: false, error: 'No authorization header' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user from JWT token
      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (userError || !user) {
        return new Response(JSON.stringify({ connected: false, error: 'Invalid user token' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Checking status for user:', user.id);

      // Check if user has valid tokens
      const { data: tokens, error: tokensError } = await supabase
        .from('google_calendar_tokens')
        .select('user_email, token_expiry')
        .eq('user_id', user.id)
        .single();

      if (tokensError || !tokens) {
        console.log('No tokens found for user');
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if token is expired
      const isExpired = new Date(tokens.token_expiry) <= new Date();
      
      return new Response(JSON.stringify({ 
        connected: !isExpired,
        email: tokens.user_email,
        expired: isExpired
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'disconnect') {
      // Disconnect calendar
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'No authorization header' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user from JWT token
      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid user token' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Disconnecting calendar for user:', user.id);

      // Delete user's tokens
      const { error: deleteError } = await supabase
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Failed to delete tokens:', deleteError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to disconnect' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Calendar disconnected successfully');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'test') {
      // Test endpoint to verify function is reachable
      console.log('=== TEST ENDPOINT CALLED ===');
      return new Response(`
        <html>
          <head><title>OAuth Function Test</title></head>
          <body>
            <h1>✅ Google Calendar OAuth Function is Working!</h1>
            <p>Function URL: ${req.url}</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
            <h3>Test the callback:</h3>
            <p><a href="?action=callback&code=test123&state=teststate">Test callback with mock parameters</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      console.log('Unknown action received:', action);
      console.log('Available actions: authorize, callback, status, disconnect, test');
      return new Response(JSON.stringify({ 
        error: 'Invalid action', 
        received: action,
        available: ['authorize', 'callback', 'status', 'disconnect', 'test']
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});