import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const accessToken = searchParams.get('access_token');

  if (!query || !accessToken) {
    console.error('Missing parameters:', { query, hasToken: !!accessToken });
    return NextResponse.json({ error: 'Missing query or access token' }, { status: 400 });
  }

  try {
    console.log('Searching Spotify with query:', query);
    console.log('Using access token:', accessToken.substring(0, 10) + '...');

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return NextResponse.json({ error: `Spotify API error: ${errorData.error?.message || response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('Spotify API response:', data);

    // Check if we have tracks in the response
    if (!data.tracks || !data.tracks.items) {
      console.error('No tracks found in response:', data);
      return NextResponse.json({ tracks: { items: [] } });
    }

    // Filter out explicit tracks and tracks longer than 5 minutes
    const filteredTracks = data.tracks.items.filter((track: any) => 
      !track.explicit && track.duration_ms <= 300000
    );

    return NextResponse.json({ tracks: { items: filteredTracks } });
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return NextResponse.json({ error: `Failed to search Spotify: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
} 