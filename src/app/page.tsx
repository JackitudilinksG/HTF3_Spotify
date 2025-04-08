'use client';
import Script from 'next/script';

import { useState, useEffect, FormEvent } from 'react';
import { verifyTeamCode, verifyAdminCode } from '@/lib/appwrite';

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
  explicit: boolean;
  external_urls?: {
    spotify: string;
  };
}

export default function Home() {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 s
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  const POLLING_INTERVAL = 3000; // 3 seconds

  const [text, setText] = useState<string>('');
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [currentlyPlaying, setCurrentlyPlaying] = useState<SpotifyTrack | null>(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
    const storedIsAdmin = localStorage.getItem('isAdmin');
    
    if (storedLoginState === 'true' && storedTeamName) {
      const lastActivityTime = storedLastActivity ? parseInt(storedLastActivity) : Date.now();
      if (Date.now() - lastActivityTime <= SESSION_TIMEOUT) {
        setIsLoggedIn(true);
        setTeamName(storedTeamName);
        setIsAdmin(storedIsAdmin === 'true');
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
    let isMounted = true;

    // Only start polling if we're logged in
    if (isLoggedIn) {
      // Initial fetch
      fetchQueue();
      if (spotifyAccessToken) {
        fetchCurrentlyPlaying();
      }

      // Set up polling interval
      pollInterval = setInterval(async () => {
        if (isMounted) {
          await fetchQueue();
          if (spotifyAccessToken) {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
              headers: {
                'Authorization': `Bearer ${spotifyAccessToken}`,
              },
            });

            if (response.status === 200) {
              const data = await response.json();
              if (data.item) {
                const track = {
                  id: data.item.id,
                  name: data.item.name,
                  artists: data.item.artists,
                  album: data.item.album,
                  uri: data.item.uri,
                  duration_ms: data.item.duration_ms,
                  explicit: data.item.explicit,
                  external_urls: data.item.external_urls
                };
                setCurrentlyPlaying(track);
              } else {
                // No track is currently playing, check if we should play the next song
                if (queue.length > 0 && isAdmin) {
                  console.log('No track playing, attempting to play next song...');
                  await handlePlayNext();
                }
                setCurrentlyPlaying(null);
              }
            } else if (response.status === 401) {
              // Token expired, clear it
              const tokenKey = `spotifyAccessToken_${teamName}`;
              localStorage.removeItem(tokenKey);
              setSpotifyAccessToken(null);
            }
          } else {
            // Try to reconnect to Spotify if token is missing
            const tokenKey = `spotifyAccessToken_${teamName}`;
            const storedToken = localStorage.getItem(tokenKey);
            if (storedToken) {
              setSpotifyAccessToken(storedToken);
            }
          }
        }
      }, POLLING_INTERVAL);
    }

    // Cleanup function to clear the interval when component unmounts or user logs out
    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isLoggedIn, spotifyAccessToken, teamName, queue, isAdmin]); // Add queue and isAdmin to dependencies

  // Function to fetch the current queue from the API
  const fetchQueue = async (retryCount = 0) => {
    try {
      setIsLoadingQueue(true);
      setQueueError(null);
      
      const res = await fetch('/api/queue');
      if (!res.ok) {
        throw new Error(`Failed to fetch queue: ${res.status}`);
      }
      
      const data = await res.json();
      
      // Only update queue if we have valid data
      if (data && Array.isArray(data.queue)) {
        setQueue(data.queue);
      } else {
        throw new Error('Invalid queue data received');
      }
    } catch (error) {
      console.error('Error fetching queue:', error);
      setQueueError(error instanceof Error ? error.message : 'Failed to fetch queue');
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying queue fetch (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => fetchQueue(retryCount + 1), RETRY_DELAY);
      }
    } finally {
      setIsLoadingQueue(false);
    }
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
      // Search for tracks
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(text)}&access_token=${spotifyAccessToken}`);
      const data = await res.json();
      
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
        alert('Song is not allowed or is not found');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Error searching for songs. Please try again.');
    }
  };

  const handleAddTrack = async (track: SpotifyTrack) => {
    try {
      // Check if the track is explicit
      if (track.explicit) {
        alert('Explicit songs are not allowed in the queue.');
        return;
      }

      // Check if the track is longer than 5 minutes (300,000 milliseconds)
      if (track.duration_ms > 300000) {
        alert('Songs longer than 5 minutes are not allowed in the queue.');
        return;
      }

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
      const result = await verifyAdminCode(teamName);
      if (!result.success) {
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
    } catch (error) {
      console.error('Error verifying admin status:', error);
      alert('Failed to verify admin status. Please try again.');
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    
    if (isAdminLogin) {
      if (!adminPassword.trim()) {
        alert('Please enter an admin password');
        return;
      }

      try {
        const result = await verifyAdminCode(adminPassword);
        
        if (result.success && result.admin) {
          setIsLoggedIn(true);
          const adminName = result.admin.name || 'Admin';
          setTeamName(adminName);
          setIsAdmin(true);
          setLastActivity(Date.now());
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('teamName', adminName);
          localStorage.setItem('lastActivity', Date.now().toString());
          localStorage.setItem('isAdmin', 'true');
          setShowLoginModal(false);
          setAdminPassword('');
          return;
        } else {
          alert(result.error || 'Invalid admin password');
          return;
        }
      } catch (error) {
        console.error('Admin login error:', error);
        alert('Failed to verify admin password. Please try again.');
      }
    } else {
      if (!teamCode.trim()) {
        alert('Please enter a team code');
        return;
      }

      try {
        // Verify team code
        const result = await verifyTeamCode(teamCode);
        
        if (result.success && result.team) {
          setIsLoggedIn(true);
          const teamName = result.team.team_name || 'Team Missing';
          setTeamName(teamName);
          setIsAdmin(false);
          setLastActivity(Date.now());
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('teamName', teamName);
          localStorage.setItem('lastActivity', Date.now().toString());
          localStorage.setItem('isAdmin', 'false');
          setShowLoginModal(false);
          setTeamCode('');
        } else {
          alert(result.error || 'Invalid team code');
        }
      } catch (error) {
        console.error('Team login error:', error);
        alert('Failed to verify team code. Please try again.');
      }
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
    setIsAdmin(false);

    // Clear all localStorage items
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('teamName');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('isAdmin');

    // Clear any session storage
    sessionStorage.removeItem('pendingSpotifyTeam');

    // Force a page reload to ensure clean state
    window.location.reload();
  };

  const handlePlayNext = async () => {
    if (!isLoggedIn || !spotifyAccessToken || queue.length === 0) return;

    // Check if the current user is an admin
    if (!isAdmin) {
      alert('Only admins can control music playback');
      return;
    }

    // First, get active devices
    await getActiveDevices();
    
    // If no active device, try to transfer playback to the first available device
    console.log("Selected Device: " + selectedDevice);
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
            device_id: selectedDevice || activeDevices[0]?.id
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

    // Check if the current user is an admin
    if (!isAdmin) {
      alert('Only admins can skip songs');
      return;
    }

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

  // Update the getActiveDevices function
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
      } else if (data.devices.length > 0) {
        // If no active device but we have devices, select the first one
        setSelectedDevice(data.devices[0].id);
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

  const displaySongs = async() => {
    const res = await fetch('/api/queue');
    const data = await res.json();
    console.log("Top Song URI: " + JSON.stringify(data.queue[0].uri, null, 2));
  }

  const handleRemoveTrack = async (trackId: string) => {
    try {
      const result = await verifyAdminCode(teamName);
      if (!result.success) {
        alert('Only admin can remove songs from the queue');
        return;
      }

      try {
        const newQueue = queue.filter(track => track.id !== trackId);
        setQueue(newQueue);
        
        // Update the queue on the server
        await fetch('/api/queue', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queue: newQueue }),
        });
      } catch (error) {
        console.error('Error removing track:', error);
        alert('Failed to remove track. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying admin status:', error);
      alert('Failed to verify admin status. Please try again.');
    }
  };

  // Check for terms acceptance on mount
  useEffect(() => {
    const hasAcceptedTerms = localStorage.getItem('hasAcceptedTerms');
    if (!hasAcceptedTerms) {
      setShowTermsModal(true);
    }
  }, []);

  const handleAcceptTerms = () => {
    localStorage.setItem('hasAcceptedTerms', 'true');
    setShowTermsModal(false);
  };

  // Add a function to check admin status
  const checkAdminStatus = async (teamName: string) => {
    try {
      const result = await verifyAdminCode(teamName);
      setIsAdmin(result.success);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  // Add this function to fetch the currently playing track
  const fetchCurrentlyPlaying = async () => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear it
          const tokenKey = `spotifyAccessToken_${teamName}`;
          localStorage.removeItem(tokenKey);
          setSpotifyAccessToken(null);
          return;
        }
        throw new Error('Failed to fetch currently playing track');
      }

      const data = await response.json();
      
      if (data.item) {
        const track = {
          id: data.item.id,
          name: data.item.name,
          artists: data.item.artists,
          album: data.item.album,
          uri: data.item.uri,
          duration_ms: data.item.duration_ms,
          explicit: data.item.explicit,
          external_urls: data.item.external_urls
        };
        console.log('Currently playing track:', track);
        setCurrentlyPlaying(track);
      } else {
        console.log('No track currently playing');
        setCurrentlyPlaying(null);
      }
    } catch (error) {
      console.error('Error fetching currently playing track:', error);
      setCurrentlyPlaying(null);
    }
  };

  return (
    <div style={{ 
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {showTermsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: '#DDE3FF',
            padding: '2rem',
            borderRadius: '12px',
            width: '80%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            <h2 style={{
              color: '#080A2E',
              marginBottom: '1.5rem',
              textAlign: 'center',
              fontSize: '1.8rem'
            }}>Terms and Conditions</h2>
            
            <div style={{
              marginBottom: '2rem',
              color: '#080A2E',
              lineHeight: '1.6'
            }}>
              <p style={{ marginBottom: '1rem' }}>
                Welcome to the HackToFuture3.0 Song Queue! By using this application, you agree to the following terms:
              </p>
              
              <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  This application is for HackToFuture3.0 participants only. You must use a valid team code to access the queue.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Only non-explicit songs under 5 minutes in length are allowed in the queue.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Playback control is restricted to the designated admins.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Adding songs is available to all participants.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  You must have an active Spotify account and device to play music.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  The application uses cookies to maintain your session and preferences.
                </li>
              </ol>

              <p style={{ marginBottom: '1rem' }}>
                By clicking "Accept", you acknowledge that you have read and agree to these terms.
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem'
            }}>
              <button
                onClick={handleAcceptTerms}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
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
            }}>Login</h2>
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setIsAdminLogin(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isAdminLogin ? 'rgba(8, 10, 46, 0.1)' : '#080A2E',
                  color: isAdminLogin ? '#080A2E' : '#DDE3FF',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Team Login
              </button>
              <button
                onClick={() => setIsAdminLogin(true)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isAdminLogin ? '#080A2E' : 'rgba(8, 10, 46, 0.1)',
                  color: isAdminLogin ? '#DDE3FF' : '#080A2E',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Admin Login
              </button>
            </div>
            <form onSubmit={handleLogin}>
              {isAdminLogin ? (
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                />
              ) : (
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
              )}
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
        {isLoggedIn && (
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
        {isLoadingQueue ? (
          <p style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#080A2E',
            textAlign: 'center',
            opacity: 0.5
          }}>
            Loading queue...
          </p>
        ) : queueError ? (
          <div style={{
            textAlign: 'center',
            color: '#ff4444'
          }}>
            <p style={{ marginBottom: '1rem' }}>Error loading queue: {queueError}</p>
            <button
              onClick={() => fetchQueue()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#080A2E',
                color: '#DDE3FF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : queue.length === 0 ? (
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
                {isLoggedIn && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(track.id);
                    }}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: '#ff4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ff0000'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff4444'}
                  >
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M3 6H5H21" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                      <path 
                        d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
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
      {isLoggedIn && (
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
          {currentlyPlaying && (
            <div style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2196F3',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <img 
                src={currentlyPlaying.album.images?.[0]?.url || '/default-album.png'} 
                alt={`${currentlyPlaying.album.name} cover`}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Now Playing:</div>
                <div style={{ marginBottom: '0.25rem' }}>{currentlyPlaying.name}</div>
                <div style={{ marginBottom: '0.25rem' }}>{currentlyPlaying.artists.map(artist => artist.name).join(', ')}</div>
                <div>Album: {currentlyPlaying.album.name}</div>
              </div>
            </div>
          )}
          
          {isAdmin && (
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
          )}
          
          {isAdmin && activeDevices.length > 0 && (
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
        </div>
      )}
    </div>
  );
} 