import { SpotifyTrack } from '@/types/spotify';

interface PlaybackControlsProps {
  track: SpotifyTrack;
  spotifyAccessToken: string | null;
  isAdmin: boolean;
  onPlayNext: () => void;
}

export const PlaybackControls = ({ track, spotifyAccessToken, isAdmin, onPlayNext }: PlaybackControlsProps) => {
  const handlePlay = async () => {
    if (!spotifyAccessToken || !isAdmin) return;

    try {
      // First, get active devices
      const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });

      if (!devicesRes.ok) {
        throw new Error('Failed to get devices');
      }

      const devicesData = await devicesRes.json();
      const activeDevice = devicesData.devices.find((device: any) => device.is_active);

      if (!activeDevice) {
        alert('No active Spotify device found. Please make sure Spotify is open and playing.');
        return;
      }

      // Play the track
      const playRes = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: [track.uri],
        }),
      });

      if (!playRes.ok) {
        throw new Error('Failed to play track');
      }

      onPlayNext();
    } catch (error) {
      console.error('Error playing track:', error);
      alert('Failed to play track. Please make sure Spotify is open and playing.');
    }
  };

  if (!isAdmin) return null;

  return (
    <button
      onClick={handlePlay}
      className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center space-x-2"
    >
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
          clipRule="evenodd"
        />
      </svg>
      <span>Play Now</span>
    </button>
  );
}; 