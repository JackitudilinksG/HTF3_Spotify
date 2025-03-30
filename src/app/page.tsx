'use client';

import { useState, useEffect, FormEvent } from 'react';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  uri: string;
  duration_ms: number;
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

  // Check for Spotify access token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (token) {
      setSpotifyAccessToken(token);
      // Clean up the URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

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
      // Search for tracks
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(text)}&access_token=${spotifyAccessToken}`);
      const data = await res.json();
      
      console.log('Search response:', data);
      
      if (data.error) {
        console.error('Search error:', data.error);
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
    // Send a POST request to add the track
    await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track }),
    });

    // Clear the input and update the queue
    setText('');
    setShowSearchResults(false);
    setSearchResults([]);
    fetchQueue();
  };

  const handleClear = async () => {
    await fetch('/api/queue', {
      method: 'DELETE',
    });
    fetchQueue();
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    // Here you would typically validate the team code
    console.log('Team code:', teamCode);
    setIsLoggedIn(true);
    // For demo purposes, setting a team name based on the code
    setTeamName('Team Awesome');
    setShowLoginModal(false);
    setTeamCode('');
  };

  const handleSpotifyLogin = async () => {
    try {
      console.log('Starting Spotify login process...');
      const res = await fetch('/api/spotify/auth');
      const data = await res.json();
      
      if (!data.url) {
        console.error('No auth URL received');
        alert('Failed to get Spotify authentication URL');
        return;
      }

      console.log('Got auth URL, redirecting to Spotify...');
      window.location.href = data.url;
    } catch (error) {
      console.error('Error during Spotify login:', error);
      alert('Failed to connect to Spotify. Please try again.');
    }
  };

  // Add a test function to check Spotify API
  const testSpotifyConnection = async () => {
    try {
      console.log('Testing Spotify API connection...');
      console.log('Using access token:', spotifyAccessToken?.substring(0, 10) + '...');
      
      const res = await fetch('https://api.spotify.com/v1/browse/new-releases', {
        headers: {
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Spotify API test failed:', errorData);
        alert(`Spotify API test failed: ${errorData.error?.message || 'Unknown error'}`);
        return;
      }

      const data = await res.json();
      console.log('Spotify API test successful:', data);
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
                <p style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#000',
                  textAlign: 'left',
                  margin: 0
                }}>
                  {track.name} - {track.artists[0].name}
                </p>
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
    </div>
  );
} 