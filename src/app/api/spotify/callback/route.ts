import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get the base URL from the request
function getBaseUrl(request: Request) {
  const host = request.headers.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  
  // If we're in development, use localhost
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // If we have a host header, use it
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // Fallback to the Vercel URL if available
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Final fallback
  return 'https://htfy.vercel.app';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for Spotify error response
    if (error) {
      console.error('Spotify authorization error:', error);
      return NextResponse.redirect(new URL(`/?error=spotify_auth_error&message=${error}`, request.url));
    }

    if (!code || !state) {
      console.error('Missing code or state in callback');
      return NextResponse.redirect(new URL('/?error=missing_params', request.url));
    }

    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/api/spotify/callback`;

    console.log('Exchanging code for access token...');
    console.log('Using redirect URI:', redirectUri);
    console.log('Using client ID:', SPOTIFY_CLIENT_ID?.substring(0, 5) + '...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Host:', request.headers.get('host'));
    console.log('Vercel URL:', process.env.VERCEL_URL);

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: SPOTIFY_CLIENT_ID!,
        client_secret: SPOTIFY_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      
      let errorMessage = 'token_exchange_failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse the error as JSON, use the raw text
        errorMessage = errorText;
      }
      
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url));
    }

    const data = await tokenResponse.json();
    console.log('Token exchange successful');
    
    // Redirect back to the main page with the access token
    return NextResponse.redirect(new URL(`/?access_token=${data.access_token}`, request.url));
  } catch (error) {
    console.error('Error in callback:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
} 