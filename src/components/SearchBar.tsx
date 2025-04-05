import { FormEvent, useState } from 'react';
import { SpotifyTrack } from '@/types/spotify';
import { TrackList } from './TrackList';

interface SearchBarProps {
  onAddTrack: (track: SpotifyTrack) => void;
  spotifyAccessToken: string | null;
  isLoggedIn: boolean;
}

export const SearchBar = ({ onAddTrack, spotifyAccessToken, isLoggedIn }: SearchBarProps) => {
  const [text, setText] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    if (!isLoggedIn) {
      setError('Please login with your team code first');
      return;
    }

    if (!spotifyAccessToken) {
      setError('Please connect to Spotify first');
      return;
    }

    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(text)}&access_token=${spotifyAccessToken}`);
      const data = await res.json();
      
      if (data.error) {
        console.error('Search error:', data.error);
        if (data.error.includes('expired')) {
          setError('Your Spotify session has expired. Please reconnect to Spotify.');
          return;
        }
        setError('Error searching for songs. Please try again.');
        return;
      }
      
      if (data.tracks?.items?.length > 0) {
        setSearchResults(data.tracks.items);
        setShowSearchResults(true);
        setError('');
      } else {
        setError('No songs found');
        setShowSearchResults(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Error searching for songs. Please try again.');
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search for a song..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Search
        </button>
      </form>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {showSearchResults && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-md shadow-lg">
          <TrackList
            tracks={searchResults}
            onAddTrack={(track) => {
              onAddTrack(track);
              setText('');
              setShowSearchResults(false);
            }}
            showAddButton
          />
        </div>
      )}
    </div>
  );
}; 