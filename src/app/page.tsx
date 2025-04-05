'use client';
import Script from 'next/script';
import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { LoginModal } from '@/components/LoginModal';
import { SearchBar } from '@/components/SearchBar';
import { TrackList } from '@/components/TrackList';
import { SpotifyTrack } from '@/types/spotify';

const ADMIN_CODES = ['HTF3_ADMIN1', 'HTF3_ADMIN2', 'HTF3_ADMIN3', 'HTF3_ADMIN4'];
const PLAYBACK_ADMIN = 'HTF3_ADMIN1';
const POLLING_INTERVAL = 3000; // 3 seconds

export default function Home() {
  const { isLoggedIn, teamName, handleLogin, handleLogout } = useSession();
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<SpotifyTrack | null>(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Fetch the queue on component mount and set up polling
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const fetchQueue = async () => {
      const res = await fetch('/api/queue');
      const data = await res.json();
      setQueue(data.queue);
    };

    if (isLoggedIn) {
      fetchQueue();
      pollInterval = setInterval(fetchQueue, POLLING_INTERVAL);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isLoggedIn]);

  // Handle scroll event
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleAddTrack = async (track: SpotifyTrack) => {
    try {
      const trackWithTeam = {
        ...track,
        team_name: teamName
      };

      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: trackWithTeam }),
      });

      if (!response.ok) {
        throw new Error('Failed to add track');
      }

      const data = await response.json();
      setQueue(data.queue);
    } catch (error) {
      console.error('Error adding track:', error);
      alert('Failed to add track. Please try again.');
    }
  };

  const handleClear = async () => {
    if (!ADMIN_CODES.includes(teamName)) {
      alert('Only admin can clear the queue');
      return;
    }

    try {
      const response = await fetch('/api/queue', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear queue');
      }

      setQueue([]);
    } catch (error) {
      console.error('Error clearing queue:', error);
      alert('Failed to clear queue. Please try again.');
    }
  };

  const handleSpotifyLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
    
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${scope}`;
    window.location.href = authUrl;
  };

  // Check for Spotify token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (token && teamName) {
      const tokenKey = `spotifyAccessToken_${teamName}`;
      setSpotifyAccessToken(token);
      localStorage.setItem(tokenKey, token);
      window.history.replaceState({}, '', '/');
    } else if (teamName) {
      const tokenKey = `spotifyAccessToken_${teamName}`;
      const storedToken = localStorage.getItem(tokenKey);
      if (storedToken) {
        setSpotifyAccessToken(storedToken);
      }
    }
  }, [teamName]);

  return (
    <main className="min-h-screen bg-gray-100">
      <Script src="https://sdk.scdn.co/spotify-player.js" />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Spotify Queue</h1>
          <div className="flex items-center space-x-4">
            {!isLoggedIn ? (
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Login
              </button>
            ) : (
              <>
                <span className="text-gray-700">Team: {teamName}</span>
                {!spotifyAccessToken && (
                  <button
                    onClick={handleSpotifyLogin}
                    className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    Connect Spotify
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        {isLoggedIn && (
          <>
            <div className="mb-8">
              <SearchBar
                onAddTrack={handleAddTrack}
                spotifyAccessToken={spotifyAccessToken}
                isLoggedIn={isLoggedIn}
              />
            </div>

            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Queue</h2>
              {ADMIN_CODES.includes(teamName) && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Clear Queue
                </button>
              )}
            </div>

            <TrackList tracks={queue} showRemoveButton={ADMIN_CODES.includes(teamName)} />
          </>
        )}

        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-4 right-4 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700"
          >
            ↑
          </button>
        )}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />
    </main>
  );
} 