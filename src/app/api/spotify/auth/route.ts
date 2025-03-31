import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get the base URL from the request
function getBaseUrl(request: Request) {
  // For local development, always use localhost:3000
  return 'https://htfy.vercel.app/api/spotify/callback';
}

export async function GET(request: Request) {
  try {
    const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative';
    const state = Math.random().toString(36).substring(7);

    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/api/spotify/callback`;

    console.log('Generating auth URL with:');
    console.log('Base URL:', baseUrl);
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID:', SPOTIFY_CLIENT_ID?.substring(0, 5) + '...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Host:', request.headers.get('host'));

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID!,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    console.log('Final auth URL:', authUrl);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error in auth route:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
} 