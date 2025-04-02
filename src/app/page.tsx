'use client';

import { useState, useEffect, FormEvent } from 'react';
import { verifyTeamCode } from '@/lib/appwrite';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  uri: string;
  duration_ms: number;
  team_name?: string;
}

export default function Home() {
  const [text, setText] = useState<string>('');
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  const POLLING_INTERVAL = 3000; // 3 seconds
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<SpotifyTrack | null>(null);

  // Check for session timeout
  useEffect(() => {
    const checkSessionTimeout = () => {
      const now = Date.now();
      if (isLoggedIn && (now - lastActivity > SESSION_TIMEOUT)) {
        handleLogout();
      }
    };

    const interval = setInterval(checkSessionTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isLoggedIn, lastActivity]);

  // Update last activity on user interaction
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('click', updateActivity);
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('click', updateActivity);
    };
  }, []);

  // Check for stored login state on mount
  useEffect(() => {
    const storedLoginState = localStorage.getItem('isLoggedIn');
    const storedTeamName = localStorage.getItem('teamName');
    const storedLastActivity = localStorage.getItem('lastActivity');
    
    if (storedLoginState === 'true' && storedTeamName) {
      const lastActivityTime = storedLastActivity ? parseInt(storedLastActivity) : Date.now();
      if (Date.now() - lastActivityTime <= SESSION_TIMEOUT) {
        setIsLoggedIn(true);
        setTeamName(storedTeamName);
        setLastActivity(lastActivityTime);
        
        // After setting team name, check for token in URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('access_token');
        if (token) {
          const tokenKey = `spotifyAccessToken_${storedTeamName}`;
          setSpotifyAccessToken(token);
          localStorage.setItem(tokenKey, token);
          // Clean up the URL
          window.history.replaceState({}, '', '/');
        } else {
          // Check localStorage for existing token
          const tokenKey = `spotifyAccessToken_${storedTeamName}`;
          const storedToken = localStorage.getItem(tokenKey);
          if (storedToken) {
            setSpotifyAccessToken(storedToken);
          }
        }
      } else {
        // Session expired
        handleLogout();
      }
    }
  }, []);

  // Add this useEffect after the other useEffect hooks
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    // Only start polling if we're logged in
    if (isLoggedIn) {
      // Initial fetch
      fetchQueue();

      // Set up polling interval
      pollInterval = setInterval(fetchQueue, POLLING_INTERVAL);
    }

    // Cleanup function to clear the interval when component unmounts or user logs out
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isLoggedIn]); // Only re-run if login state changes

  // Function to fetch the current queue from the API
  const fetchQueue = async () => {
    const res = await fetch('/api/queue');
    const data = await res.json();
    setQueue(data.queue);
  };

  // Fetch the queue on component mount
  useEffect(() => {
    fetchQueue();
  }, []);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    if (!isLoggedIn) {
      alert('Please login with your team code first');
      setShowLoginModal(true);
      return;
    }

    if (!spotifyAccessToken) {
      alert('Please connect to Spotify first');
      return;
    }

    try {
      console.log('Searching for:', text);
      console.log('Team name:', teamName);
      // Search for tracks
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(text)}&access_token=${spotifyAccessToken}`);
      const data = await res.json();
      
      console.log('Search response:', data);
      
      if (data.error) {
        console.error('Search error:', data.error);
        if (data.error.includes('expired')) {
          // Clear the expired token for this team
          const tokenKey = `spotifyAccessToken_${teamName}`;
          localStorage.removeItem(tokenKey);
          setSpotifyAccessToken(null);
          alert('Your Spotify session has expired. Please reconnect to Spotify.');
          return;
        }
        alert('Error searching for songs. Please try again.');
        return;
      }
      
      if (data.tracks?.items?.length > 0) {
        console.log('Found tracks:', data.tracks.items);
        setSearchResults(data.tracks.items);
        setShowSearchResults(true);
      } else {
        console.log('No tracks found');
        alert('No songs found');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Error searching for songs. Please try again.');
    }
  };

  const handleAddTrack = async (track: SpotifyTrack) => {
    try {
      // Add team name to the track before sending
      const trackWithTeam = {
        ...track,
        team_name: teamName
      };

      // Send a POST request to add the track
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: trackWithTeam }),
      });

      if (!response.ok) {
        throw new Error('Failed to add track');
      }

      // Clear the input and search results
      setText('');
      setShowSearchResults(false);
      setSearchResults([]);

      // Update the queue immediately with the new track
      const data = await response.json();
      setQueue(data.queue);
    } catch (error) {
      console.error('Error adding track:', error);
      alert('Failed to add track. Please try again.');
    }
  };

  const handleClear = async () => {
    try {
      const response = await fetch('/api/queue', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear queue');
      }

      // Update the queue immediately
      const data = await response.json();
      setQueue(data.queue);
    } catch (error) {
      console.error('Error clearing queue:', error);
      alert('Failed to clear queue. Please try again.');
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!teamCode.trim()) {
        alert('Please enter a team code');
        return;
    }

    try {
        const result = await verifyTeamCode(teamCode);
        
        if (result.success && result.team) {
            setIsLoggedIn(true);
            const teamName = result.team.team_name || 'Team Missing';
            setTeamName(teamName);
            setLastActivity(Date.now());
            // Store login state in localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('teamName', teamName);
            localStorage.setItem('lastActivity', Date.now().toString());
            setShowLoginModal(false);
            setTeamCode('');
        } else {
            alert(result.error || 'Invalid team code');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to verify team code. Please try again.');
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
      sessionStorage.setItem('pendingSpotifyTeam', teamName);
      window.location.href = data.url;
    } catch (error) {
      console.error('Error during Spotify login:', error);
      alert('Failed to connect to Spotify. Please try again.');
    }
  };

  // Add a test function to check Spotify API
  const testSpotifyConnection = async () => {
    try {
      if (!teamName) {
        console.error('No team name available');
        alert('Please login with your team code first');
        return;
      }

      console.log('Testing Spotify API connection...');
      console.log('Team name:', teamName);
      console.log('Using access token:', spotifyAccessToken?.substring(0, 10) + '...');
      
      // First, try to get the user's profile to verify the token
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });
      
      // Log the raw response for debugging
      console.log('Profile response status:', profileRes.status);
      console.log('Profile response headers:', Object.fromEntries(profileRes.headers.entries()));
      
      // Try to get the response text first
      const profileText = await profileRes.text();
      console.log('Raw profile response:', profileText);
      
      if (!profileRes.ok) {
        console.error('Profile check failed:', profileText);
        // Clear the invalid token for this team
        const tokenKey = `spotifyAccessToken_${teamName}`;
        localStorage.removeItem(tokenKey);
        setSpotifyAccessToken(null);
        alert('Your Spotify connection has expired. Please reconnect to Spotify.');
        return;
      }

      // If profile check succeeds, try the new releases endpoint
      const res = await fetch('https://api.spotify.com/v1/browse/new-releases', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });
      
      // Log the raw response for debugging
      console.log('New releases response status:', res.status);
      console.log('New releases response headers:', Object.fromEntries(res.headers.entries()));
      
      // Try to get the response text first
      const responseText = await res.text();
      console.log('Raw new releases response:', responseText);
      
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        // If it's not JSON, create a simple error object
        errorData = {
          error: {
            message: responseText || 'Unknown error',
            status: res.status
          }
        };
      }
      
      if (!res.ok) {
        console.error('Spotify API test failed:', errorData);
        if (errorData.error?.message?.includes('expired')) {
          // Clear the expired token for this team
          const tokenKey = `spotifyAccessToken_${teamName}`;
          localStorage.removeItem(tokenKey);
          setSpotifyAccessToken(null);
          alert('Your Spotify session has expired. Please reconnect to Spotify.');
          return;
        }
        alert(`Spotify API test failed: ${errorData.error?.message || 'Unknown error'}`);
        return;
      }

      // Parse the successful response
      const data = JSON.parse(responseText);
      console.log('Spotify API test successful:', data);
      
      // Store the token in localStorage after successful test
      if (spotifyAccessToken) {
        const tokenKey = `spotifyAccessToken_${teamName}`;
        localStorage.setItem(tokenKey, spotifyAccessToken);
      }
      alert('Successfully connected to Spotify API!');
    } catch (error) {
      console.error('Error testing Spotify connection:', error);
      alert(`Failed to test Spotify connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add this helper function after the interface
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    if (teamName) {
      const tokenKey = `spotifyAccessToken_${teamName}`;
      localStorage.removeItem(tokenKey);
    }
    setIsLoggedIn(false);
    setTeamName('');
    setSpotifyAccessToken(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('teamName');
    localStorage.removeItem('lastActivity');
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim()) {
      alert('Please enter an admin code');
      return;
    }

    try {
      // In a real app, you would verify this against your backend
      if (adminCode === 'HTF3_ADMIN') { // Replace with your actual admin code
        setIsAdmin(true);
        setShowAdminModal(false);
        setAdminCode('');
        // Start polling for queue updates more frequently when admin
        setPollingInterval(1000); // Poll every second when admin
      } else {
        alert('Invalid admin code');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      alert('Failed to verify admin code. Please try again.');
    }
  };

  const handlePlayNext = async () => {
    if (!isAdmin || !spotifyAccessToken || queue.length === 0) return;

    try {
      const nextTrack = queue[0];
      
      // Call Spotify API to play the track
      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: [nextTrack.uri],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to play track');
      }

      // Update currently playing track
      setCurrentlyPlaying(nextTrack);
      
      // Remove the played track from the queue
      const newQueue = queue.slice(1);
      setQueue(newQueue);
      
      // Update the queue on the server
      await fetch('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: newQueue }),
      });
    } catch (error) {
      console.error('Error playing track:', error);
      alert('Failed to play track. Please try again.');
    }
  };

  const handleQueueUpdate = async (newQueue: SpotifyTrack[]) => {
    if (!isAdmin) return;
    
    try {
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#DDE3FF',
            padding: '2rem',
            borderRadius: '8px',
            width: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              color: '#080A2E',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>Enter Team Code</h2>
            <form onSubmit={handleLogin}>
              <input
                type="text"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="Enter your team code"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ccc',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#080A2E',
                    color: '#DDE3FF',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
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
              <span
                style={{
                  color: '#DDE3FF',
                  textDecoration: 'none',
                  fontSize: '1.1rem'
                }}
              >
                {teamName}
              </span>
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
            {!spotifyAccessToken && (
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
            {spotifyAccessToken && (
              <button
                onClick={testSpotifyConnection}
                style={{
                  color: '#DDE3FF',
                  textDecoration: 'none',
                  fontSize: '1.1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Test Spotify Connection
              </button>
            )}
            <a
              href="#queue-list"
              style={{
                color: '#DDE3FF',
                textDecoration: 'none',
                fontSize: '1.1rem'
              }}
            >
              Queue
            </a>
          </div>
        </div>
      </nav>
      <form onSubmit={handleSubmit} style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '5rem' }}>
        <input
          type="text"
          placeholder="Name of song in Spotify"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: '250px', padding: '0.5rem' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', marginLeft: '1rem' }}>
          Search
        </button>
        <button 
          type="button" 
          onClick={handleClear}
          style={{ padding: '0.5rem 1rem', marginLeft: '1rem' }}
        >
          Clear
        </button>
      </form>

      {showSearchResults && (
        <div style={{
          marginTop: '2rem',
          width: '50%',
          backgroundColor: '#DDE3FF',
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#080A2E' }}>Search Results:</h3>
          {searchResults.map((track) => (
            <div
              key={track.id}
              onClick={() => handleAddTrack(track)}
              style={{
                padding: '1rem',
                marginBottom: '0.5rem',
                backgroundColor: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            >
              <div style={{ fontWeight: 'bold', color: '#080A2E' }}>{track.name}</div>
              <div style={{ color: '#666' }}>
                {track.artists[0].name} • {track.album.name} • {formatDuration(track.duration_ms)}
              </div>
            </div>
          ))}
        </div>
      )}

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
          queue.map((track, index) => (
            <div key={track.id} style={{
              padding: '1rem',
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#080A2E',
              textAlign: 'left',
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{
                  fontSize: '1.2rem',
                  color: '#666',
                  minWidth: '2rem',
                  textAlign: 'center'
                }}>
                  {index + 1}.
                </span>
                <div>
                  <p style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#000',
                    textAlign: 'left',
                    margin: 0
                  }}>
                    {track.name} - {track.artists[0].name}
                  </p>
                  <p style={{
                    fontSize: '1rem',
                    color: '#666',
                    margin: '0.25rem 0 0 0'
                  }}>
                    Added by: {track.team_name}
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: '1.2rem',
                color: '#666',
                marginLeft: '1rem',
                whiteSpace: 'nowrap'
              }}>
                {formatDuration(track.duration_ms)}
              </span>
            </div>
          ))
        )}
        
      </div>
      {isLoggedIn && (
          <button
            onClick={handleLogout}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ff4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              marginTop: '1rem',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#cc0000'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff4444'}
          >
            Logout
          </button>
        )}
      {isAdmin ? (
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <button
            onClick={handlePlayNext}
            disabled={!currentlyPlaying && queue.length === 0}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: queue.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              opacity: queue.length === 0 ? 0.5 : 1
            }}
          >
            Play Next Song
          </button>
          {currentlyPlaying && (
            <div style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2196F3',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '1rem'
            }}>
              Now Playing: {currentlyPlaying.name} - {currentlyPlaying.artists[0].name}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowAdminModal(true)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#080A2E',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            marginTop: '1rem'
          }}
        >
          Become Admin
        </button>
      )}
      {showAdminModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#DDE3FF',
            padding: '2rem',
            borderRadius: '8px',
            width: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              color: '#080A2E',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>Enter Admin Code</h2>
            <form onSubmit={handleAdminLogin}>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Enter admin code"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ccc',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#080A2E',
                    color: '#DDE3FF',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 