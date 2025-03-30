import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';

export async function GET() {
  const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative';
  const state = Math.random().toString(36).substring(7);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID!,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state,
  });

  return NextResponse.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
} 