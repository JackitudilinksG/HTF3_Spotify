import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get the base URL from the request
function getBaseUrl(request: Request) {
  // For local development, always use localhost:3000
  return 'https://htfy.vercel.app';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

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
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
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