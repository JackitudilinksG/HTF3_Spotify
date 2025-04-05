import { SpotifyTrack } from '@/types/spotify';
import { formatDuration, getSpotifyTrackUrl } from '@/utils/formatting';
import { PlaybackControls } from './PlaybackControls';

interface TrackListProps {
  tracks: SpotifyTrack[];
  onAddTrack?: (track: SpotifyTrack) => void;
  onRemoveTrack?: (trackId: string) => void;
  showAddButton?: boolean;
  showRemoveButton?: boolean;
  spotifyAccessToken?: string | null;
  isAdmin?: boolean;
  onPlayNext?: () => void;
}

export const TrackList = ({
  tracks,
  onAddTrack,
  onRemoveTrack,
  showAddButton = false,
  showRemoveButton = false,
  spotifyAccessToken,
  isAdmin = false,
  onPlayNext,
}: TrackListProps) => {
  return (
    <div className="space-y-2">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className="flex items-center justify-between p-3 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-4 flex-1">
            {track.album.images?.[0] && (
              <img
                src={track.album.images[0].url}
                alt={track.album.name}
                className="w-12 h-12 rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <a
                href={getSpotifyTrackUrl(track)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate"
              >
                {track.name}
              </a>
              <p className="text-sm text-gray-500 truncate">
                {track.artists.map((artist) => artist.name).join(', ')}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {formatDuration(track.duration_ms)}
            </div>
          </div>
          <div className="flex space-x-2 ml-4">
            {index === 0 && spotifyAccessToken && onPlayNext && (
              <PlaybackControls
                track={track}
                spotifyAccessToken={spotifyAccessToken}
                isAdmin={isAdmin}
                onPlayNext={onPlayNext}
              />
            )}
            {showAddButton && onAddTrack && (
              <button
                onClick={() => onAddTrack(track)}
                className="px-3 py-1 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700"
              >
                Add
              </button>
            )}
            {showRemoveButton && onRemoveTrack && (
              <button
                onClick={() => onRemoveTrack(track.id)}
                className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}; 