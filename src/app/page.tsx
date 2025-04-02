'use client';

import { useState, useEffect, FormEvent } from 'react';
import { verifyTeamCode } from '@/lib/appwrite';

interface SpotifyTrack {
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
  const [currentlyPlaying, setCurrentlyPlaying] = useState<SpotifyTrack | null>(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

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
    // Only allow admin to clear the queue
    if (teamName !== 'ADMIN') {
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
        // Check if the code is an admin code
        if (teamCode === 'HTF3_ADMIN') {
            setIsLoggedIn(true);
            setTeamName('ADMIN');
            setLastActivity(Date.now());
            // Store login state in localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('teamName', 'ADMIN');
            localStorage.setItem('lastActivity', Date.now().toString());
            setShowLoginModal(false);
            setTeamCode('');
            return;
        }

        // If not admin code, proceed with team code verification
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
      // For admin, always use 'ADMIN' as the team name
      const currentTeamName = teamName === 'ADMIN' ? 'ADMIN' : teamName;
      sessionStorage.setItem('pendingSpotifyTeam', currentTeamName);
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
    // Clear Spotify token if exists
    console.log('Log out Button clicked');
    if (teamName) {
      const tokenKey = `spotifyAccessToken_${teamName}`;
      localStorage.removeItem(tokenKey);
    }

    // Clear all state
    setIsLoggedIn(false);
    setTeamName('');
    setSpotifyAccessToken(null);
    setQueue([]);
    setSearchResults([]);
    setShowSearchResults(false);
    setCurrentlyPlaying(null);
    setActiveDevices([]);
    setSelectedDevice(null);
    setShowTeamDropdown(false);

    // Clear all localStorage items
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('teamName');
    localStorage.removeItem('lastActivity');

    // Clear any session storage
    sessionStorage.removeItem('pendingSpotifyTeam');

    // Force a page reload to ensure clean state
    window.location.reload();
  };

  const handlePlayNext = async () => {
    if (!isLoggedIn || !spotifyAccessToken || queue.length === 0) return;

    // Only allow HTF3_ADMIN1 to control playback
    if (teamName !== 'ADMIN') {
      alert('Only the admin device can control playback');
      return;
    }

    try {
      // First, get active devices
      await getActiveDevices();
      
      // If no active device, try to transfer playback to the first available device
      if (!selectedDevice && activeDevices.length > 0) {
        const deviceId = activeDevices[0].id;
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${spotifyAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_ids: [deviceId],
            play: false,
          }),
        });
        setSelectedDevice(deviceId);
      }

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
      alert('Failed to play track. Please make sure you have an active Spotify device.');
    }
  };

  const handleQueueUpdate = async (newQueue: SpotifyTrack[]) => {
    if (!isLoggedIn) return;
    
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

  // Add this new function to handle skipping the current song
  const handleSkip = async () => {
    if (!isLoggedIn || !spotifyAccessToken || queue.length === 0) return;

    // Only allow HTF3_ADMIN1 to control playback
    if (teamName !== 'HTF3_ADMIN1') {
      alert('Only the admin device can control playback');
      return;
    }

    try {
      // Call Spotify API to skip the current track
      const response = await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to skip track');
      }

      // Remove the current track from the queue
      const newQueue = queue.slice(1);
      setQueue(newQueue);
      
      // Update the queue on the server
      await fetch('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: newQueue }),
      });
    } catch (error) {
      console.error('Error skipping track:', error);
      alert('Failed to skip track. Please try again.');
    }
  };

  // Add this function to generate Spotify track URL
  const getSpotifyTrackUrl = (track: SpotifyTrack) => {
    return `https://open.spotify.com/track/${track.id}`;
  };

  // Add click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.team-dropdown')) {
        setShowTeamDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add this new function to get active devices
  const getActiveDevices = async () => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get devices');
      }

      const data = await response.json();
      setActiveDevices(data.devices);
      
      // If there's an active device, select it
      const activeDevice = data.devices.find((device: any) => device.is_active);
      if (activeDevice) {
        setSelectedDevice(activeDevice.id);
      }
    } catch (error) {
      console.error('Error getting devices:', error);
    }
  };

  // Add this useEffect to check for active devices when Spotify is connected
  useEffect(() => {
    if (spotifyAccessToken) {
      getActiveDevices();
    }
  }, [spotifyAccessToken]);

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
                  <div style={{
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
                    zIndex: 1000
                  }}>
                    <button
                      onClick={handleLogout}
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
        {teamName === 'ADMIN' && (
          <button 
            type="button" 
            onClick={handleClear}
            style={{ padding: '0.5rem 1rem', marginLeft: '1rem' }}
          >
            Clear Queue
          </button>
        )}
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
                {track.artists.map(artist => artist.name).join(', ')} • {track.album.name} • {formatDuration(track.duration_ms)}
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
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#080A2E',
              textAlign: 'left',
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flex: 1
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
                    {track.name}
                  </p>
                  <p style={{
                    fontSize: '1.2rem',
                    color: '#666',
                    margin: '0.25rem 0'
                  }}>
                    {track.artists.map(artist => artist.name).join(', ')}
                  </p>
                  <p style={{
                    fontSize: '1rem',
                    color: '#666',
                    margin: '0.25rem 0'
                  }}>
                    Album: {track.album.name}
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{
                  fontSize: '1.2rem',
                  color: '#666',
                  whiteSpace: 'nowrap'
                }}>
                  {formatDuration(track.duration_ms)}
                </span>
                <a
                  href={track.external_urls?.spotify || getSpotifyTrackUrl(track)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#1DB954',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1ed760'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1DB954'}
                >
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M7 17L17 7M17 7H8M17 7V16" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
      {isLoggedIn && teamName === 'HTF3_ADMIN1' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: 'rgba(8, 10, 46, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '800px'
        }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
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
            <button
              onClick={handleSkip}
              disabled={queue.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#FF9800',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: queue.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: queue.length === 0 ? 0.5 : 1
              }}
            >
              Skip Current Song
            </button>
          </div>
          
          {activeDevices.length > 0 && (
            <div style={{ color: '#DDE3FF' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Active Devices:</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {activeDevices.map((device) => (
                  <div
                    key={device.id}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: device.is_active ? '#4CAF50' : 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => {
                      setSelectedDevice(device.id);
                      // Transfer playback to selected device
                      fetch('https://api.spotify.com/v1/me/player', {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${spotifyAccessToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          device_ids: [device.id],
                          play: false,
                        }),
                      });
                    }}
                  >
                    {device.name}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {currentlyPlaying && (
            <div style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2196F3',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '1rem'
            }}>
              <div style={{ fontWeight: 'bold' }}>Now Playing:</div>
              <div>{currentlyPlaying.name}</div>
              <div>{currentlyPlaying.artists.map(artist => artist.name).join(', ')}</div>
              <div>Album: {currentlyPlaying.album.name}</div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
} 