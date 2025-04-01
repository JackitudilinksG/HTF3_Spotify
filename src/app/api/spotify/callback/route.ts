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
    const error = searchParams.get('error');

    if (error) {
      console.error('Spotify authorization error:', error);
      return NextResponse.redirect(`${getBaseUrl(request)}?error=spotify_auth_failed`);
    }

    if (!code) {
      console.error('No code received from Spotify');
      return NextResponse.redirect(`${getBaseUrl(request)}?error=no_code`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `https://htfy4.vercel.app/api/spotify/callback`,
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
      return NextResponse.redirect(`${getBaseUrl(request)}?error=token_exchange_failed`);
    }

    const data = await tokenResponse.json();
    const accessToken = data.access_token;

    // Redirect back to the main page with the access token
    return NextResponse.redirect(`${getBaseUrl(request)}?access_token=${accessToken}`);
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(`${getBaseUrl(request)}?error=callback_error`);
  }
} 