import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Get the base URL from the request
function getBaseUrl(request: Request) {
  // Get the host from the request
  const host = request.headers.get('host');
  if (!host) {
    throw new Error('No host header found');
  }

  // Always use https in production
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  try {
    const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative';
    const state = Math.random().toString(36).substring(7);

    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/api/spotify/callback`;

    console.log('Generating auth URL with redirect URI:', redirectUri);
    console.log('Using client ID:', SPOTIFY_CLIENT_ID?.substring(0, 5) + '...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Host:', request.headers.get('host'));

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID!,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
    });

    return NextResponse.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  } catch (error) {
    console.error('Error in auth route:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
} 