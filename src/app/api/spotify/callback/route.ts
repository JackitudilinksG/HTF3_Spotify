import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    console.error('Missing code or state in callback');
    return NextResponse.redirect(new URL('/?error=missing_params', request.url));
  }

  try {
    console.log('Exchanging code for access token...');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
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