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
    // Remove any port numbers from the host
    const cleanHost = host.split(':')[0];
    return `${protocol}://${cleanHost}`;
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
    const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-read-playback-state';
    const state = Math.random().toString(36).substring(7);

    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/api/spotify/callback`;

    console.log('Generating auth URL with:');
    console.log('Base URL:', baseUrl);
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID:', SPOTIFY_CLIENT_ID?.substring(0, 5) + '...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Host:', request.headers.get('host'));
    console.log('Vercel URL:', process.env.VERCEL_URL);
    console.log('Protocol:', process.env.NODE_ENV === 'development' ? 'http' : 'https');
    console.log('Full request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

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