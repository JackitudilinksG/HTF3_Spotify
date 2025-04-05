export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { 
    name: string;
    images?: { url: string }[];
  };
  uri: string;
  duration_ms: number;
  team_name?: string;
  external_urls?: {
    spotify: string;
  };
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
} 