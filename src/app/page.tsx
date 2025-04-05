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
    try {
      if (!teamName) {
        alert('Please login with your team code first');
        setShowLoginModal(true);
        return;
      }

      // Clear any cached Spotify data for this team
      const tokenKey = `spotifyAccessToken_${teamName}`;
      localStorage.removeItem(tokenKey);
      setSpotifyAccessToken(null);
      
      console.log('Starting Spotify login process...');
      console.log('Current window location:', window.location.href);
      console.log('Team name:', teamName);
      
      const res = await fetch('/api/spotify/auth');
      const data = await res.json();
      
      if (!data.url) {
        console.error('No auth URL received');
        alert('Failed to get Spotify authentication URL');
        return;
      }

      console.log('Auth URL received:', data.url);
      // Parse the URL to check the redirect URI
      const authUrl = new URL(data.url);
      const redirectUri = authUrl.searchParams.get('redirect_uri');
      console.log('Redirect URI in auth URL:', redirectUri);

      // Store the current team name in sessionStorage before redirecting
      // For admin, always use 'ADMIN' as the team name
      const currentTeamName = teamName === 'ADMIN' ? 'ADMIN' : teamName;
      sessionStorage.setItem('pendingSpotifyTeam', currentTeamName);
      window.location.href = data.url;
    } catch (error) {
      console.error('Error during Spotify login:', error);
      alert('Failed to connect to Spotify. Please try again.');
    }
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

  const handlePlayNext = async () => {
    if (!queue.length) return;
    
    try {
      // Remove the first track from the queue
      const newQueue = queue.slice(1);
      setQueue(newQueue);
      
      // Update the queue on the server
      await fetch('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: newQueue }),
      });
    } catch (error) {
      console.error('Error updating queue:', error);
    }
  };

  return (
    <div style={{ 
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
        />
      )}
      
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: 'rgba(8, 10, 46, 0.7)',
            backdropFilter: 'blur(10px)',
            color: '#DDE3FF',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
            zIndex: 1000
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          ↑
        </button>
      )}

      <nav style={{
        width: '70%',
        height: '80px',
        backgroundColor: 'rgba(8, 10, 46, 0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '30px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          maxWidth: '1200px',
          width: '100%',
          justifyContent: 'space-between'
        }}>
          <img 
            src="/HTF_logo_svg.svg"
            alt="Logo"
            style={{
              height: '50px',
              width: '50px'
            }}
          />
          <div style={{
            display: 'flex',
            gap: '2rem'
          }}>
            {isLoggedIn ? (
              <div style={{ position: 'relative' }}>
                <span
                  onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                  style={{
                    color: '#DDE3FF',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {teamName}
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      transform: showTeamDropdown ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <path 
                      d="M6 9L12 15L18 9" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {showTeamDropdown && (
                  <div 
                    className="team-dropdown"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      marginTop: '0.5rem',
                      backgroundColor: 'rgba(8, 10, 46, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      zIndex: 1000,
                      minWidth: '150px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogout();
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        color: '#ff4444',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          d="M17 16L21 12M21 12L17 8M21 12H7M7 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H7" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a 
                href="#queue-form"
                onClick={(e) => {
                  e.preventDefault();
                  setShowLoginModal(true);
                }}
                style={{
                  color: '#DDE3FF',
                  textDecoration: 'none',
                  fontSize: '1.1rem'
                }}
              >
                Login
              </a>
            )}
            {!spotifyAccessToken && isLoggedIn && (
              <button
                onClick={handleSpotifyLogin}
                style={{
                  color: '#DDE3FF',
                  textDecoration: 'none',
                  fontSize: '1.1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Connect Spotify
              </button>
            )}
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#DDE3FF',
                textDecoration: 'none',
                fontSize: '1.1rem'
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify
            </a>
          </div>
        </div>
      </nav>

      {isLoggedIn && (
        <>
          <div style={{ marginTop: '5rem', width: '100%' }}>
            <SearchBar
              onAddTrack={handleAddTrack}
              spotifyAccessToken={spotifyAccessToken}
              isLoggedIn={isLoggedIn}
            />
          </div>

          <p style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            color: '#DDE3FF',
            marginTop: '1rem',
            marginBottom: '0.75rem'
          }}>Queued Songs</p>

          <div style={{
            padding: '2rem',
            minHeight: '100px',
            width: '50%',
            backgroundColor: '#DDE3FF',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {queue.length === 0 ? (
              <p style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#080A2E',
                textAlign: 'center',
                opacity: 0.5
              }}>
                Add songs to the queue
              </p>
            ) : (
              <TrackList 
                tracks={queue} 
                showRemoveButton={ADMIN_CODES.includes(teamName)}
                spotifyAccessToken={spotifyAccessToken}
                isAdmin={ADMIN_CODES.includes(teamName)}
                onPlayNext={handlePlayNext}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
} 