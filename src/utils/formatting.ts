import { SpotifyTrack } from '../types/spotify';

export const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const getSpotifyTrackUrl = (track: SpotifyTrack) => {
  return track.external_urls?.spotify || '#';
}; 